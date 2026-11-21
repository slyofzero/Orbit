// check.ts section: images. Run: bun run check
import { hashImage, imageProblem, imageRef, refToHash } from "@/lib/images";
import { ok } from "@/scripts/checks/helpers";

console.log("images");
{
  const a = await hashImage(new TextEncoder().encode("picture"));
  const b = await hashImage(new TextEncoder().encode("picture"));
  const c = await hashImage(new TextEncoder().encode("other"));
  ok(a === b && a !== c && /^h[0-9a-f]{32}$/.test(a), "same bytes → same name, different bytes → different name");
  ok(refToHash(imageRef(a)) === a && refToHash("https://x") === null, "img:<hash> round trip");
  ok(
    imageProblem({ type: "text/plain", size: 10 }) !== null &&
      imageProblem({ type: "image/png", size: 6e6 }) !== null &&
      imageProblem({ type: "image/png", size: 1000 }) === null,
    "file checks: type and 5 MB limit",
  );
}
