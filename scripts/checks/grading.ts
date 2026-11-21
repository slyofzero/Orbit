// check.ts section: grading. Run: bun run check
import { gradeMcq, gradeMsq, gradeNat, gradeStr, marksFor, parseNumber } from "@/lib/grade";
import { ok } from "@/scripts/checks/helpers";

console.log("grading");
{
  ok(gradeMcq(1, 1) === "correct" && gradeMcq(1, 2) === "incorrect" && gradeMcq(1, null) === null, "mcq");
  ok(gradeMsq([0, 2], [2, 0]) === "correct", "msq: same set in any order is right");
  ok(gradeMsq([0, 2], [0]) === "incorrect" && gradeMsq([0, 2], [0, 1, 2]) === "incorrect", "msq: all-or-nothing");
  ok(gradeMsq([0], []) === null, "msq: nothing picked = unanswered");
  ok(
    parseNumber(" -2.5 ") === -2.5 && parseNumber(".5") === 0.5 && parseNumber("1e3") === 1000,
    "parseNumber accepts numbers",
  );
  ok(
    parseNumber("2,5") === null && parseNumber("abc") === null && parseNumber("") === null,
    "parseNumber rejects non-numbers",
  );
  ok(gradeNat(3.14, 0.01, "3.15") === "correct" && gradeNat(3.14, 0.01, "3.16") === "incorrect", "nat: tolerance");
  ok(
    gradeNat(2, 0, "2.0") === "correct" && gradeNat(2, 0, "x") === "incorrect" && gradeNat(2, 0, " ") === null,
    "nat: exact, junk, blank",
  );
  ok(
    gradeStr("exact", false, ["Binary Search"], "  binary   search ") === "correct",
    "str exact: case and spaces ignored",
  );
  ok(gradeStr("exact", true, ["Binary Search"], "binary search") === "incorrect", "str exact: case sensitive");
  ok(gradeStr("exact", false, ["colour", "color"], "Color") === "correct", "str: any accepted answer");
  ok(
    gradeStr("list", false, ["a, b, c"], "a,b,c") === "correct" &&
      gradeStr("list", false, ["a, b, c"], "c, b, a") === "incorrect",
    "str list: order matters",
  );
  ok(
    gradeStr("set", false, ["a, b, c"], "c, a, b") === "correct" &&
      gradeStr("set", false, ["a, b, c"], "a, b") === "incorrect",
    "str set: order ignored",
  );
  ok(
    marksFor("correct", 2, 0.67) === 2 && marksFor("incorrect", 2, 0.67) === -0.67 && marksFor(null, 2, 0.67) === 0,
    "marksFor",
  );
}
