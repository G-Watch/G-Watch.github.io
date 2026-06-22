import { siteConfig } from "@/lib/site-config";
import { withBasePath } from "@/lib/paths";

/**
 * The brand lockup shown in the header and footer. Renders logo + name,
 * logo only, or name only per `siteConfig.brand.mode`, falling back to the
 * name when a logo mode is selected but no logo is set.
 */
export function Brand({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { name, brand } = siteConfig;

  const hasLogo = brand.mode !== "name-only" && Boolean(brand.logo);
  const showName =
    brand.mode === "name-only" ||
    brand.mode === "logo-and-name" ||
    !hasLogo;

  const logoHeight = size === "lg" ? "h-8" : "h-7";
  const nameSize = size === "lg" ? "text-2xl" : "text-lg";

  return (
    <span className="inline-flex items-center gap-2">
      {hasLogo && (
        // Plain <img>: the static export has no next/image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={withBasePath(brand.logo as string)}
          alt={brand.logoAlt ?? name}
          className={`${logoHeight} w-auto`}
        />
      )}
      {showName && (
        <span
          className={`font-serif ${nameSize} font-bold tracking-tight text-ink`}
        >
          {name}
          <span className="text-accent">.</span>
        </span>
      )}
    </span>
  );
}
