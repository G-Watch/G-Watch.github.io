import { Fragment } from "react";

/**
 * A post title with the frontmatter `highlight` word set in the highlight
 * color (app/theme.css). Without a highlight the title renders as is.
 */
export function TitleText({
  title,
  highlight,
}: {
  title: string;
  highlight?: string;
}) {
  if (!highlight || !title.includes(highlight)) return <>{title}</>;
  return (
    <>
      {title.split(highlight).map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-highlight">{highlight}</span>}
          {part}
        </Fragment>
      ))}
    </>
  );
}
