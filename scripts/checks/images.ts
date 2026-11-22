// check.ts section: images. Run: bun run check
import { hashImage, imageHashes, imageProblem, imageRef, pictureSizes, refToHash, setPictureSize } from "@/lib/images";
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
  ok(
    imageHashes(["a ![x](img:h1 50%) b ![y](img:h2)", null, "![x](img:h1) ![z](https://e.com/a.png)"]).join() ===
      "h1,h2",
    "imageHashes: each picture once, web pictures ignored",
  );
  const t = "a ![x](img:h1) b ![y](https://e.com/p.png 75%) c ![w](img:h3)";
  ok(pictureSizes(t).join() === ",75,", "pictureSizes: in order, null = full width");
  ok(
    setPictureSize(t, 0, 50) === "a ![x](img:h1 50%) b ![y](https://e.com/p.png 75%) c ![w](img:h3)" &&
      setPictureSize(t, 1, 100).includes("![y](https://e.com/p.png) c") &&
      setPictureSize(t, 2, 75).endsWith("![w](img:h3 75%)") &&
      setPictureSize(t, 9, 50) === t,
    "setPictureSize: changes only the chosen picture; 100% drops the tag",
  );
}
