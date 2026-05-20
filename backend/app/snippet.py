"""Block-level snippet helpers for the click-to-edit feature.

The workspace canvas lets the user click on a paragraph of the
compiled PDF, which opens a small editor with the corresponding LaTeX
*block* (a paragraph delimited by blank lines, in source order). On
save, that block is spliced back into the project's `latex_source`.

This module owns the source-level parsing and splicing. The PDF→source
mapping itself lives in :mod:`latex_compile` (synctex parser).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.latex_compile import SyncTexPoint


@dataclass
class TexBlock:
    """A contiguous chunk of LaTeX source the user can edit as one unit.

    ``start_line`` and ``end_line`` are both 1-indexed and inclusive,
    matching the convention synctex uses for line numbers. ``content``
    is the raw text of those lines joined with ``\n``.
    """

    start_line: int
    end_line: int
    content: str


def parse_blocks(latex_source: str) -> list[TexBlock]:
    """Split ``latex_source`` into editable blocks separated by blank lines.

    A "block" here is the smallest unit the click-to-edit UI exposes —
    typically one paragraph, one ``\\section{...}``, or one
    environment header / body chunk. Blank lines act as separators and
    are not part of any block.
    """
    lines = latex_source.split("\n")
    blocks: list[TexBlock] = []
    current_start: int | None = None
    current_lines: list[str] = []
    for i, line in enumerate(lines, 1):
        if line.strip() == "":
            if current_start is not None:
                blocks.append(
                    TexBlock(
                        start_line=current_start,
                        end_line=i - 1,
                        content="\n".join(current_lines),
                    ),
                )
                current_start = None
                current_lines = []
        else:
            if current_start is None:
                current_start = i
            current_lines.append(line)
    if current_start is not None:
        blocks.append(
            TexBlock(
                start_line=current_start,
                end_line=len(lines),
                content="\n".join(current_lines),
            ),
        )
    return blocks


# Lines that synctex frequently tags for the page bounding box even
# when they're nowhere near the click. Excluding them stops clicks on
# blank margins from opening the document-closing tag for editing.
_STRUCTURAL_PREFIXES = (
    "\\begin{document}",
    "\\end{document}",
    "\\documentclass",
)


def _is_structural_line(latex_source: str, line_no: int) -> bool:
    lines = latex_source.split("\n")
    if line_no < 1 or line_no > len(lines):
        return False
    return lines[line_no - 1].strip().startswith(_STRUCTURAL_PREFIXES)


def locate_block(
    *,
    page: int,
    x_pt: float,
    y_pt: float,
    synctex_points: list[SyncTexPoint],
    blocks: list[TexBlock],
    latex_source: str,
) -> TexBlock | None:
    """Return the block whose source line is closest to the clicked spot.

    Synctex emits page-bounding-box points whose ``line`` is the
    ``\\end{document}`` line — those would otherwise dominate the
    nearest-neighbour search and route every click to the end tag. We
    drop them up front and only consider points that map to real
    content lines.
    """
    page_pts = [p for p in synctex_points if p.page == page]
    if not page_pts:
        return None
    content_pts = [
        p for p in page_pts if not _is_structural_line(latex_source, p.line)
    ]
    candidates = content_pts or page_pts
    nearest = min(
        candidates,
        key=lambda p: (p.x_pt - x_pt) ** 2 + (p.y_pt - y_pt) ** 2,
    )
    target_line = nearest.line
    for block in blocks:
        if block.start_line <= target_line <= block.end_line:
            # Skip structural blocks even if synctex pointed at them —
            # the user clicked on content, not on the boilerplate.
            if block.content.strip().startswith(_STRUCTURAL_PREFIXES):
                continue
            return block
    # Synctex landed on a blank-line gap between paragraphs. Pick the
    # nearest non-structural block by line distance so the click never
    # silently does nothing.
    editable = [
        b
        for b in blocks
        if not b.content.strip().startswith(_STRUCTURAL_PREFIXES)
    ]
    if not editable:
        return None
    return min(
        editable,
        key=lambda b: min(
            abs(b.start_line - target_line),
            abs(b.end_line - target_line),
        ),
    )


def splice_block(
    *,
    latex_source: str,
    start_line: int,
    end_line: int,
    new_content: str,
) -> str:
    """Replace lines [start_line, end_line] with ``new_content``.

    Line numbers are 1-indexed and inclusive. The new content can have
    any number of lines (including zero) — we simply re-join the
    surviving prefix, the new lines, and the surviving suffix.
    """
    lines = latex_source.split("\n")
    # Clamp so a stale snippet doesn't blow up the splice if the user
    # edited the doc elsewhere in the meantime. We just take the best
    # effort and let the recompile catch any structural issue.
    start = max(1, min(start_line, len(lines) + 1))
    end = max(start - 1, min(end_line, len(lines)))
    prefix = lines[: start - 1]
    suffix = lines[end:]
    new_lines = new_content.split("\n")
    return "\n".join(prefix + new_lines + suffix)
