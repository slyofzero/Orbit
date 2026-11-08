// Run on YOUR computer:  bun run scripts/check-runner.ts
// Shows which languages Orbit can run here, and runs a tiny program in each to prove it works.
import { commandFor, installHint, judge } from "../lib/runner";
import { CODE_LANGUAGES, LANGUAGE_LABEL, type CodeLanguage } from "../lib/codeLanguages";

const progs: Record<CodeLanguage, string> = {
  python: "print(sum(map(int, input().split())))",
  javascript: "const [a,b]=require('fs').readFileSync(0,'utf8').trim().split(' ').map(Number); console.log(a+b)",
  c: '#include <stdio.h>\nint main(){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}',
  cpp: "#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<std::endl;}",
  java: "import java.util.*;\npublic class Main{public static void main(String[] x){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}",
};

console.log(`Platform: ${process.platform}\n`);
let ok = 0;
for (const l of CODE_LANGUAGES) {
  const cmd = commandFor(l);
  if (!cmd) { console.log(`✗ ${LANGUAGE_LABEL[l].padEnd(11)} not found. ${installHint(l)}`); continue; }
  const r = await judge(l, progs[l], ["1 2", "40 2"], 8000);
  const got = r.results.map((x) => x.stdout.trim()).join(",");
  if (r.compileError || got !== "3,42") console.log(`✗ ${LANGUAGE_LABEL[l].padEnd(11)} found (${cmd.join(" ")}) but the test program failed: ${(r.compileError ?? JSON.stringify(r.results[0] ?? r)).slice(0, 300)}`);
  else { ok++; console.log(`✓ ${LANGUAGE_LABEL[l].padEnd(11)} works (${cmd.join(" ")})`); }
}
console.log(`\n${ok} of ${CODE_LANGUAGES.length} languages work. Only the ones you need have to.`);
