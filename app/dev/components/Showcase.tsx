"use client";
// Every shared component, live, in one page. Flip the theme in the top bar to check light and dark.
// Sample content is generic on purpose: Orbit is not tied to any one exam.
//
// EVERY component below shows LaTeX at least once, so a component that fails to render maths
// stands out immediately (you would see raw $…$ text).
// Writing maths in JSX: inside an attribute string (label="$\frac{1}{2}$") backslashes and braces
// are literal. As JSX children, put it in a JS string: {"$\\frac{1}{2}$"}. A bare {1} in JSX
// text is a JavaScript expression and the braces disappear.

import { useCallback, useRef, useState, type ReactNode } from "react";
import type { QuestionRow } from "@/types/tables";
import {
  Button,
  Callout,
  Card,
  Checkbox,
  CodeEditor,
  DatePicker,
  Dialog,
  Dropdown,
  EmptyState,
  Heading,
  IconButton,
  Kbd,
  Pill,
  ProgressBar,
  RadioGroup,
  Rich,
  RichEditor,
  Segmented,
  Spinner,
  Stat,
  Switch,
  Table,
  Tabs,
  TextArea,
  TextField,
  ThemeToggle,
  useToast,
  Tooltip,
  HelpTip,
  HelpDialog,
  CopyButton,
  Divider,
  Warm,
  Text,
  Code,
  Link,
  Disclosure,
  FileInput,
  type Column,
  NavRail,
} from "@/components/ui";
import {
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
  IconArrowRight,
  IconSparkle,
  IconCalendar,
  IconCheck,
  IconCode,
  IconSigma,
  IconHome,
  IconLines,
  IconStar,
  IconBars,
} from "@/components/icons";
import { ImageProvider } from "@/components/utils";
import { addDays, todayIST } from "@/lib/dates";
import type { CodeLang } from "@/lib/codeIndent";
import { hashImage, imageRef } from "@/lib/images";
import { CodeQuestion, McqQuestion, MsqQuestion, NatQuestion, StrQuestion } from "@/components/question";

// ---------------------------------------------------------------------------
// sample data

const base = (over: Partial<QuestionRow> & Pick<QuestionRow, "id" | "type" | "stem">): QuestionRow => ({
  topic_id: "tp_demo",
  pack_id: null,
  pool: "practice",
  marks: 1,
  negative_marks: 0,
  difficulty: "medium",
  explanation: null,
  content_hash: "demo",
  legacy_id: null,
  created_at: 0,
  updated_at: 0,
  retired_at: null,
  ...over,
});

const Q_MCQ = base({
  id: "q_mcq",
  type: "mcq",
  marks: 1,
  negative_marks: 0.33,
  difficulty: "easy",
  stem: "What is the determinant of the $3 \\times 3$ identity matrix $I_3$?",
  explanation: "The determinant of a diagonal matrix is the product of its diagonal: $1 \\cdot 1 \\cdot 1 = 1$.",
});
const Q_MSQ = base({
  id: "q_msq",
  type: "msq",
  marks: 2,
  negative_marks: 0,
  difficulty: "medium",
  stem: "Which of these functions are continuous at $x = 0$?",
  explanation:
    "$|x|$ and $x^2$ are continuous everywhere. $\\frac{1}{x}$ is undefined at $0$, and $\\lfloor x \\rfloor$ jumps there.",
});
const Q_NAT = base({
  id: "q_nat",
  type: "nat",
  marks: 2,
  negative_marks: 0,
  difficulty: "hard",
  stem: "Evaluate the integral, correct to two decimal places:\n$$\\int_0^1 e^{x}\\,dx$$",
  explanation: "$\\int_0^1 e^x\\,dx = e - 1 \\approx 1.718$.",
});
const Q_STR = base({
  id: "q_str",
  type: "str",
  marks: 1,
  negative_marks: 0,
  difficulty: "easy",
  stem: "List every prime $p$ with $p < 10$, separated by commas (any order).",
  explanation: "The primes below $10$ are $2, 3, 5, 7$. ($1$ is not prime.)",
});
const Q_CODE = base({
  id: "q_code",
  type: "code",
  marks: 2,
  negative_marks: 0,
  difficulty: "medium",
  stem: "Write a function `is_palindrome(s)` that returns `True` when the string reads the same forwards and backwards, ignoring case, in $O(n)$ time.",
  explanation: null,
});

type TopicRow = { topic: string; answered: number; accuracy: number; time: number };
const TOPICS: TopicRow[] = [
  { topic: "Probability $P(\\cdot)$", answered: 42, accuracy: 0.48, time: 31 },
  { topic: "Linear algebra $\\mathbb{R}^n$", answered: 65, accuracy: 0.81, time: 18 },
  { topic: "Calculus $\\int$", answered: 30, accuracy: 0.67, time: 24 },
  { topic: "Algorithms $O(n)$", answered: 51, accuracy: 0.73, time: 40 },
];

const SWATCHES = [
  "--pad",
  "--sheet",
  "--sheet-2",
  "--ink",
  "--gray",
  "--line",
  "--accent",
  "--accent-soft",
  "--hi",
  "--hi-soft",
  "--green",
  "--green-soft",
  "--red",
  "--red-soft",
  "--blue",
  "--blue-soft",
  "--amber",
  "--amber-soft",
  "--hero",
];

// ---------------------------------------------------------------------------
// page

const SECTIONS: [string, string][] = [
  ["colours", "Colours"],
  ["type", "Typography"],
  ["buttons", "Buttons"],
  ["fields", "Text fields"],
  ["pickers", "Date & dropdown"],
  ["editor", "Text editor"],
  ["tips", "Tooltips"],
  ["choices", "Checkboxes & radios"],
  ["nav", "Navigation rail"],
  ["switches", "Switch & segmented"],
  ["pills", "Pills"],
  ["tabs", "Tabs"],
  ["cards", "Cards & stats"],
  ["progress", "Progress"],
  ["callouts", "Callouts"],
  ["table", "Table"],
  ["dialog", "Dialog"],
  ["toast", "Toast"],
  ["dividers", "Dividers"],
  ["empty", "Empty state"],
  ["warm", "Warm special"],
  ["rich", "Markdown & maths"],
  ["questions", "Questions"],
];

/** In-memory picture store for this page only (the real app will keep pictures in the database). */
function useMemoryImages() {
  const store = useRef(new Map<string, string>());
  const resolve = useCallback((hash: string) => store.current.get(hash), []);
  const add = useCallback(async (file: File) => {
    const hash = await hashImage(await file.arrayBuffer());
    if (!store.current.has(hash)) store.current.set(hash, URL.createObjectURL(file));
    return imageRef(hash);
  }, []);
  return { resolve, add };
}

export function Showcase() {
  const images = useMemoryImages();
  return (
    <ImageProvider resolve={images.resolve}>
      <div className="grid grid-cols-[200px_minmax(0,1fr)] items-start gap-8 max-[860px]:grid-cols-1">
        <nav
          className="sticky top-[76px] grid gap-0.5 text-[0.9rem] max-[860px]:static max-[860px]:flex max-[860px]:flex-wrap max-[860px]:gap-1"
          aria-label="Sections"
        >
          {SECTIONS.map(([id, label]) => (
            <Link key={id} href={`#${id}`} variant="nav" className="flex! px-2.5! py-[5px]! font-semibold!">
              {label}
            </Link>
          ))}
        </nav>
        <div className="grid min-w-0 gap-10">
          <Heading level={1}>Components</Heading>
          <Callout tone="info" title="Every component here shows maths at least once">
            {
              "If you ever see raw text like $\\frac{a}{b}$ instead of a rendered formula, that component is not rendering markdown + LaTeX."
            }
          </Callout>
          <Callout tone="special" title="Special style $\star$">
            {
              "Most components also come in a **special** version: an animated gradient for things worth celebrating. Use it sparingly, $\\le 2$ per screen."
            }
          </Callout>
          <Colours />
          <Typography />
          <Buttons />
          <Fields />
          <Pickers />
          <EditorDemo onAddImage={images.add} />
          <Tips />
          <Choices />
          <NavDemo />
          <Switches />
          <Pills />
          <TabsDemo />
          <Cards />
          <ProgressDemo />
          <Callouts />
          <TableDemo />
          <DialogDemo />
          <ToastDemo />
          <DividerDemo />
          <EmptyDemo />
          <WarmDemo />
          <RichDemo />
          <Questions />
        </div>
      </div>
    </ImageProvider>
  );
}

function Section({
  id,
  title,
  path,
  note,
  children,
}: {
  id: string;
  title: string;
  path: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-3.5">
      <header className="grid gap-1 border-b-2 border-ink pb-2">
        <Heading level={2}>{title}</Heading>
        <Code>{path}</Code>
        {note && (
          <Text variant="muted" className="text-[0.92rem]">
            {note}
          </Text>
        )}
      </header>
      {children}
    </section>
  );
}

const Demo = ({ children, caption }: { children: ReactNode; caption?: string }) => (
  <div className="grid gap-4 rounded-lg border border-line bg-sheet p-5">
    {caption && (
      <Text variant="caption" as="span">
        {caption}
      </Text>
    )}
    {children}
  </div>
);

// ---------------------------------------------------------------------------

function Colours() {
  return (
    <Section
      id="colours"
      title="Colours"
      path="app/site.css"
      note="Theme variables. Always use these; never hard-code a colour. Count: $19$ swatches."
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
        {SWATCHES.map((v) => (
          <div key={v} className="overflow-hidden rounded-md border border-line bg-sheet text-[0.8rem]">
            <div className="h-11 border-b border-line" style={{ background: `var(${v})` }} />
            <span className="block px-2 py-1.5 font-mono">{v}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Typography() {
  return (
    <Section
      id="type"
      title="Typography"
      path="app/site.css · components/ui/Heading.tsx"
      note="Bricolage Grotesque for headings and numbers, Atkinson Hyperlegible Next for reading."
    >
      <Demo caption="Heading component, levels $1$–$3$">
        <Heading level={1}>{"Heading one: $e^{i\\pi} + 1 = 0$"}</Heading>
        <Heading level={2}>{"Heading two: $\\sum_{k=1}^{n} k$"}</Heading>
        <Heading level={3}>{"Heading three: $\\sqrt{2}$"}</Heading>
      </Demo>
      <Demo caption="Text component · components/ui/Text.tsx: one style per job">
        <Text>
          {
            "**body**: set for long reading sessions, e.g. $\\sin^2\\theta + \\cos^2\\theta = 1$. Inline `code` looks like this."
          }
        </Text>
        <Text variant="muted">{"**muted**: quieter supporting text, e.g. $n = 42$ questions."}</Text>
        <Text variant="small">{"**small**: fine print, e.g. updated $3$ min ago."}</Text>
        <Text variant="hint">{"**hint**: help under a field, e.g. $x \\in \\mathbb{R}$."}</Text>
        <Text variant="caption">{"caption: a label above a group, $\\S 1$"}</Text>
        <Text variant="error">{"**error**: what went wrong, e.g. $h > 24$ is not a valid number of hours."}</Text>
        <Text block>{"**block**: full markdown in one go.\n\n- a list with $\\alpha$\n- and $\\beta$"}</Text>
      </Demo>
      <Demo caption="Inline code and links · Text.tsx, Link.tsx">
        <Text>
          Inline code shows exactly what was typed, no maths: <Code>{"$x^2$ stays $x^2$"}</Code>
        </Text>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="https://katex.org">{"inline link (external, new tab) $\\nearrow$"}</Link>
          <Link href="/dev" variant="subtle">
            {"subtle link $\\to$ /dev"}
          </Link>
          <Link href="#type" variant="nav" active>
            {"nav link (active) $\\bullet$"}
          </Link>
          <Link href="#buttons" variant="nav">
            {"nav link $\\circ$"}
          </Link>
        </div>
      </Demo>
      <Demo caption="Special headings">
        <Heading level={1} special>
          {"You finished the plan! $100\\%$"}
        </Heading>
        <Heading level={2} special>
          {"New personal best: $\\frac{46}{50}$"}
        </Heading>
        <Heading level={3} special>
          {"Streak: $30$ days"}
        </Heading>
      </Demo>
    </Section>
  );
}

function Buttons() {
  const [loading, setLoading] = useState(false);
  return (
    <Section
      id="buttons"
      title="Buttons"
      path="components/ui/Button.tsx"
      note="One primary button per screen. Danger is only for destructive actions."
    >
      <Demo caption="Variants">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">{"Primary $\\alpha$"}</Button>
          <Button variant="secondary">{"Secondary $\\beta$"}</Button>
          <Button variant="soft">{"Soft $\\gamma$"}</Button>
          <Button variant="ghost">{"Ghost $\\delta$"}</Button>
          <Button variant="danger" icon={<IconTrash />}>
            {"Delete $\\varnothing$"}
          </Button>
          <Button variant="special" icon={<IconSparkle />}>
            {"Special $\\star$"}
          </Button>
        </div>
      </Demo>
      <Demo caption="Sizes, icons, states">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm">
            {"Small $x$"}
          </Button>
          <Button variant="primary" size="md">
            {"Medium $x^2$"}
          </Button>
          <Button variant="primary" size="lg">
            {"Large $x^3$"}
          </Button>
          <Button variant="soft" icon={<IconUpload />}>
            {"Import pack $\\uparrow$"}
          </Button>
          <Button variant="secondary" iconAfter={<IconArrowRight />}>
            {"Next $n+1$"}
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            {loading ? "Saving $\\ldots$" : "Click to load $\\circlearrowright$"}
          </Button>
          <Button variant="primary" disabled>
            {"Disabled $\\times$"}
          </Button>
        </div>
      </Demo>
      <Demo caption="Icon buttons and spinners (no visible text: $\varnothing$)">
        <div className="flex flex-wrap items-center gap-3">
          <IconButton label="Add">
            <IconPlus />
          </IconButton>
          <IconButton label="Search">
            <IconSearch />
          </IconButton>
          <IconButton label="Delete" disabled>
            <IconTrash />
          </IconButton>
          <IconButton label="Add (small)" size="sm">
            <IconPlus />
          </IconButton>
          <IconButton label="Search (ghost)" variant="ghost">
            <IconSearch />
          </IconButton>
          <IconButton label="Add (small ghost, used in toolbars)" size="sm" variant="ghost">
            <IconPlus />
          </IconButton>
          <Spinner label="Loading" />
          <Spinner label="Loading" special />
          <Button variant="special" loading>
            {"Building your plan $\\ldots$"}
          </Button>
        </div>
      </Demo>
      <Demo caption="Copy buttons · components/ui/CopyButton.tsx: the icon turns into ✓ once copied">
        <div className="flex flex-wrap items-center gap-3">
          <Code>{"E = mc^2"}</Code>
          <CopyButton text="E = mc^2" />
          <CopyButton text="$\int_0^1 x\,dx = \tfrac{1}{2}$" label="Copy $\LaTeX$" copiedLabel="Copied $\checkmark$" />
          <CopyButton text={() => "A long AI prompt, built only when clicked."} label="Copy prompt" variant="primary" />
          <CopyButton text="small" label="Copy" size="sm" variant="ghost" />
        </div>
      </Demo>
    </Section>
  );
}

function Fields() {
  const [name, setName] = useState("");
  const [diff, setDiff] = useState<string | null>("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [pic, setPic] = useState<File[]>([]);
  return (
    <Section id="fields" title="Text fields" path="components/ui/Field.tsx · FileInput.tsx">
      <Demo>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <TextField
            label="Profile name $\mathcal{P}$"
            placeholder="e.g. Asha"
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint="Shown at the top of the planner, e.g. $\text{Hi, Asha}$."
          />
          <TextField
            label="Search $\mathcal{Q}$"
            placeholder="Search questions…"
            help="Matches question text, e.g. $\int$ or **eigen**."
          />
          <TextField
            label="Hours per day $h$"
            inputMode="decimal"
            defaultValue="abc"
            error="That is not a number. Type something like $4$ or $5.5$."
          />
          <TextField label="Disabled $\bot$" value="Can't edit this" disabled readOnly />
          <Dropdown
            label="Difficulty $d$"
            value={diff}
            onChange={setDiff}
            hint="Lists always use **Dropdown**: the browser's own list can't be styled or show maths."
            options={[
              { value: "easy", label: "Easy $\\checkmark$" },
              { value: "medium", label: "Medium $\\sim$" },
              { value: "hard", label: "Hard $\\times$" },
            ]}
          />
        </div>
        <TextArea
          label="Note for this day $\Delta$"
          placeholder="Anything to remember…"
          hint="Maths like $x^2$ is allowed."
        />
        <CodeDemo />
        <FileInput
          label="Question packs $\mathcal{P}$ (several files)"
          accept="application/json,.json"
          multiple
          files={files}
          onChange={setFiles}
          title="Drop your question packs here"
          description="JSON files · several are merged into one pack $\cup$"
          help="A pack file exported from Orbit or made with an AI chat."
          hint="Drag files onto the box (watch it light up) or press **Browse**."
        />
        <FileInput
          label="Profile picture (one file) $\pi$"
          accept="image/*"
          files={pic}
          onChange={setPic}
          title="Drop a picture here"
          description="PNG, JPG or WebP · shows a preview once chosen"
        />
      </Demo>
    </Section>
  );
}

/** One sample program per language, so switching the language shows its highlighting at once. */
const SAMPLES: Record<CodeLang, string> = {
  python:
    'def binary_search(xs, target):\n    """Return the index of target in sorted xs, or -1."""\n    lo, hi = 0, len(xs) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if xs[mid] == target:\n            return mid\n        elif xs[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1  # not found\n',
  c: '#include <stdio.h>\n\nint gcd(int a, int b) {\n    while (b != 0) {\n        int t = b;\n        b = a % b;\n        a = t;\n    }\n    return a;\n}\n\nint main(void) {\n    printf("%d\\n", gcd(48, 18)); // 6\n    return 0;\n}\n',
  cpp: "#include <vector>\n#include <algorithm>\n\nint maxSubarray(const std::vector<int>& a) {\n    int best = a[0], cur = 0;\n    for (int x : a) {\n        cur = std::max(x, cur + x);\n        best = std::max(best, cur);\n    }\n    return best; // Kadane, O(n)\n}\n",
  java: "public class Fib {\n    static long fib(int n) {\n        long a = 0, b = 1;\n        for (int i = 0; i < n; i++) {\n            long t = a + b;\n            a = b;\n            b = t;\n        }\n        return a;\n    }\n}\n",
  javascript:
    'function debounce(fn, ms) {\n  let timer = null;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  };\n}\n\nconst save = debounce(() => console.log("saved"), 500);\n',
  sql: "SELECT t.name,\n  COUNT(*) AS answered,\n  AVG(a.correct) AS accuracy\nFROM answers a\nJOIN topics t ON t.id = a.topic_id\nWHERE a.answered_at >= '2026-11-01'\nGROUP BY t.name\nORDER BY accuracy DESC;\n",
  text: "Plain text: no highlighting.\n  Indentation still works,\n    and so do the guides.\n",
};

function CodeDemo() {
  const [lang, setLang] = useState<CodeLang>("python");
  const [code, setCode] = useState<Record<CodeLang, string>>(SAMPLES);
  return (
    <CodeEditor
      label="Code editor $\lambda$"
      language={lang}
      onLanguageChange={setLang}
      value={code[lang]}
      onChange={(v) => setCode((c) => ({ ...c, [lang]: v }))}
      rows={12}
      help="Pick the language above the editor. Highlighting and indent size follow it."
      hint="Enter keeps the indent (one more after **:** or **{**), Tab / Shift+Tab indent and outdent, Backspace removes a whole level. Ctrl+Z undoes any of these."
    />
  );
}

function Pickers() {
  const today = todayIST();
  const [exam, setExam] = useState<string | null>(addDays(today, 90));
  const [start, setStart] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>("la");
  const [type, setType] = useState<string | null>(null);
  return (
    <Section
      id="pickers"
      title="Date picker & dropdown"
      path="components/ui/DatePicker.tsx · Dropdown.tsx"
      note="Custom replacements for the browser's date and select fields. Both work with the keyboard and close on Esc or a click outside."
    >
      <Demo>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <DatePicker
            label="Exam date $t_0$"
            value={exam}
            onChange={setExam}
            min={today}
            help="Countdown $= t_0 - \text{today}$. The plan ends on this day."
            hint="Only dates $\ge$ today. Arrow keys move, PageUp/PageDown change month."
          />
          <DatePicker
            label="Plan start (optional) $t_s$"
            value={start}
            onChange={setStart}
            clearable
            placeholder="Not set: $\varnothing$"
          />
          <Dropdown
            label="Topic $\tau$"
            value={topic}
            onChange={setTopic}
            searchable
            options={[
              { value: "prob", label: "Probability $P(A)$", description: "$42$ questions" },
              { value: "la", label: "Linear algebra $A\\mathbf{x} = \\mathbf{b}$", description: "$65$ questions" },
              { value: "calc", label: "Calculus $\\frac{dy}{dx}$", description: "$30$ questions" },
              { value: "algo", label: "Algorithms $O(n \\log n)$", description: "$51$ questions" },
              { value: "db", label: "Databases $\\bowtie$", description: "No questions yet: $0$", disabled: true },
              { value: "ml", label: "Machine learning $\\nabla L$", description: "$48$ questions" },
              { value: "stats", label: "Statistics $\\bar{x}$", description: "$37$ questions" },
            ]}
            hint="Searchable: start typing to filter ($n \to$ fewer)."
          />
          <Dropdown
            label="Question type $\kappa$"
            value={type}
            onChange={setType}
            placeholder="Any type: $\forall$"
            options={[
              { value: "mcq", label: "Single choice $\\{a\\}$", icon: <IconCheck /> },
              { value: "nat", label: "Numerical $\\mathbb{R}$", icon: <IconSigma /> },
              { value: "code", label: "Code $\\lambda$", icon: <IconCode /> },
              { value: "date", label: "Dated $t$", icon: <IconCalendar /> },
            ]}
            hint="Type a letter to jump to it."
          />
        </div>
      </Demo>
    </Section>
  );
}

function EditorDemo({ onAddImage }: { onAddImage: (f: File) => Promise<string> }) {
  const [text, setText] = useState(
    "## Bayes' theorem\nFor events $A$ and $B$ with $P(B) > 0$:\n$$P(A \\mid B) = \\frac{P(B \\mid A)\\,P(A)}{P(B)}$$\n" +
      "- **Prior**: $P(A)$\n- *Likelihood*: $P(B \\mid A)$\n- ++Posterior++: what we want\n\n> Tip: draw a tree diagram first.\n\n" +
      "Read more on [Wikipedia](https://en.wikipedia.org/wiki/Bayes%27_theorem).",
  );
  return (
    <Section
      id="editor"
      title="Text editor"
      path="components/ui/RichEditor.tsx · lib/markdown.ts · lib/editing.ts"
      note="Markdown + LaTeX. Bold, italic, underline, strikethrough, headings, lists, quotes, links, pictures (upload, paste or web address), maths with live preview, code. Ctrl+Z undoes any toolbar action."
    >
      <RichEditor
        label="Notes for this topic $\mathcal{N}$"
        value={text}
        onChange={setText}
        onAddImage={onAddImage}
        help="Write $\LaTeX$ between dollar signs."
        hint="Markdown and $\LaTeX$ are supported."
        placeholder="Write notes… use the toolbar or markdown."
      />
    </Section>
  );
}

function Tips() {
  const [match, setMatch] = useState<string | null>("set");
  return (
    <Section
      id="tips"
      title="Tooltips"
      path="components/ui/Tooltip.tsx · Disclosure.tsx"
      note="HelpTip: a ? beside any text, shown on hover, keyboard focus or tap (Esc or a tap elsewhere closes it). HelpDialog: the big version, opens a dialog. Tooltip: wraps any button or link. All support markdown and maths."
    >
      <Demo caption="? beside text">
        <Heading level={2}>
          {"Topic strength"}
          <HelpTip>{"Accuracy weighted by **recency** and **difficulty**: $s = \\frac{W_r + K p}{W + K}$."}</HelpTip>
        </Heading>
        <Text>
          {"Negative marking"}
          <HelpTip>
            {
              "A wrong answer takes marks away, e.g. $-\\frac{1}{3}$ of the question's marks. Leaving it blank costs nothing."
            }
          </HelpTip>
          {" is shown on every question card. Skipped questions"}
          <HelpTip placement="right">
            {"Shown, but left unanswered: $\\text{skipped} = \\text{visited} - \\text{correct} - \\text{incorrect}$."}
          </HelpTip>
          {" are counted separately."}
        </Text>
      </Demo>
      <Demo caption="Big help: HelpDialog opens a dialog instead of a bubble (e.g. Formatting help in the text editor)">
        <div className="flex flex-wrap items-center gap-3">
          <Text as="span">{"How topic strength is worked out"}</Text>
          <HelpDialog title="How topic strength works $s$">
            <Text block>
              {
                "Every answer gets a weight $w = \\text{recency} \\times \\text{difficulty}$.\n\n$$\\text{recency} = 0.5^{\\,\\text{age}/14}$$\n\nThen strength is smoothed towards your average $p$:\n\n$$s = \\frac{W_{\\text{right}} + 5p}{W + 5}$$"
              }
            </Text>
            <Table
              caption="Difficulty weights"
              rowKey={(r) => r.d}
              rows={[
                { d: "Easy", r: "$0.8$", w: "$1.3$" },
                { d: "Medium", r: "$1.0$", w: "$1.0$" },
                { d: "Hard", r: "$1.3$", w: "$0.8$" },
              ]}
              columns={[
                { key: "d", header: "Difficulty", cell: (x) => x.d },
                { key: "r", header: "Right", cell: (x) => x.r, align: "right" },
                { key: "w", header: "Wrong", cell: (x) => x.w, align: "right" },
              ]}
            />
          </HelpDialog>
          <HelpDialog title="Keyboard shortcuts $\hookleftarrow$" label="Keyboard shortcuts">
            <Text>
              Press <Kbd>Esc</Kbd> to close any dialog and <Kbd>Enter</Kbd> to check an answer.
            </Text>
          </HelpDialog>
          <HelpDialog special title="What's new $\star$" label="What's new (special)">
            <Text block>{"- **Warm** gradient $\\Delta T > 0$\n- Copy buttons\n- Dividers"}</Text>
          </HelpDialog>
        </div>
      </Demo>
      <Demo caption="? on field labels: the help prop">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <TextField
            label="Recency half-life $h$ (days)"
            defaultValue="14"
            inputMode="numeric"
            help="An answer's weight is $0.5^{\,\text{age}/h}$: after $h$ days it counts **half** as much."
          />
          <Dropdown
            label="Answer matching"
            value={match}
            onChange={setMatch}
            help="How a typed answer $a$ is compared with the accepted set $S$: $a \in S$?"
            options={[
              { value: "exact", label: "Whole answer" },
              { value: "list", label: "List, in order" },
              { value: "set", label: "List, any order" },
            ]}
          />
        </div>
      </Demo>
      <Demo caption="Disclosure: show / hide extra content in place">
        <Disclosure title="Advanced options $\theta$">
          <Text>
            {"Hidden until opened. Good for settings most people never touch, e.g. the smoothing constant $K = 5$."}
          </Text>
        </Disclosure>
        <Disclosure title="Open by default $\checkmark$" defaultOpen>
          <Text variant="muted">{"Starts open; click the title to close it."}</Text>
        </Disclosure>
      </Demo>
      <Demo caption="Tooltip on buttons, four placements">
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip content="Shown above: $\uparrow$">
            <Button variant="soft">{"Top $\\uparrow$"}</Button>
          </Tooltip>
          <Tooltip content="Shown below: $\downarrow$" placement="bottom">
            <Button variant="soft">{"Bottom $\\downarrow$"}</Button>
          </Tooltip>
          <Tooltip content="Shown on the left: $\leftarrow$" placement="left">
            <Button variant="soft">{"Left $\\leftarrow$"}</Button>
          </Tooltip>
          <Tooltip content="Shown on the right: $\rightarrow$" placement="right">
            <Button variant="soft">{"Right $\\rightarrow$"}</Button>
          </Tooltip>
          <Tooltip content="Delete this question: $q \to \varnothing$">
            <IconButton label="Delete">
              <IconTrash />
            </IconButton>
          </Tooltip>
        </div>
      </Demo>
    </Section>
  );
}

function Choices() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [r, setR] = useState<"all" | "wrong" | "new">("all");
  return (
    <Section id="choices" title="Checkboxes & radios" path="components/ui/Choice.tsx">
      <Demo>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <div className="grid gap-2.5">
            <Text variant="caption" as="span">
              {"Checkboxes $\\checkmark$"}
            </Text>
            <Checkbox
              checked={a}
              onChange={setA}
              label="Show explanations $\because$"
              description="Right after you check an answer, e.g. why $\det I = 1$."
            />
            <Checkbox checked={b} onChange={setB} label="Shuffle options $\sigma \in S_n$" />
            <Checkbox checked={false} onChange={() => {}} label="Disabled $\bot$" disabled />
          </div>
          <RadioGroup
            legend="Which questions? $Q \subseteq \mathcal{Q}$"
            value={r}
            onChange={setR}
            options={[
              { value: "all", label: "All questions $\\mathcal{Q}$" },
              {
                value: "wrong",
                label: "Only ones I got wrong $Q_\\times$",
                description: "Your mistake log: latest answer $= \\times$.",
              },
              { value: "new", label: "Only new ones $Q_\\varnothing$" },
            ]}
          />
        </div>
      </Demo>
    </Section>
  );
}

function NavDemo() {
  return (
    <Section
      id="nav"
      title="Navigation rail"
      path="components/ui/NavRail.tsx"
      note="v1's main menu: a narrow rail on desktop, a bottom bar on phones (the footer then floats top-right). Shown here at a fixed size."
    >
      <Demo>
        <NavRail
          className="static! h-[420px]! w-24! rounded-lg border"
          brand={{ title: "Orbit", subtitle: "study hub $\\star$", href: "/dev/components" }}
          items={[
            { href: "/dev/components", label: "Today", icon: <IconHome /> },
            { href: "/dev/planner", label: "Planner", icon: <IconLines /> },
            { href: "/dev/practice", label: "Practice $\\pi$", icon: <IconStar /> },
            { href: "/dev/stats", label: "Stats", icon: <IconBars /> },
          ]}
          footer={<ThemeToggle compact />}
        />
      </Demo>
    </Section>
  );
}

function Switches() {
  const [on, setOn] = useState(true);
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [mode, setMode] = useState<"normal" | "timed" | "boss">("normal");
  return (
    <Section
      id="switches"
      title="Switch & segmented"
      path="components/ui/Switch.tsx · Segmented.tsx · ThemeToggle.tsx"
      note="Switch applies at once. Segmented picks one of a few options. The theme toggle saves to orbit.theme."
    >
      <Demo>
        <div className="flex flex-wrap items-center gap-3">
          <Switch checked={on} onChange={setOn} label="Sound effects $\sim$" />
          <Switch checked={false} onChange={() => {}} label="Disabled $\bot$" disabled />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Calendar view"
            value={view}
            onChange={setView}
            segments={[
              { value: "day", label: "Day $d$" },
              { value: "week", label: "Week $7d$" },
              { value: "month", label: "Month $\\approx 30d$" },
            ]}
          />
          <ThemeToggle />
          <ThemeToggle compact />
        </div>
      </Demo>
      <Demo caption="Special: one segment, or all of them">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Practice mode (one special)"
            value={mode}
            onChange={setMode}
            special={["boss"]}
            segments={[
              { value: "normal", label: "Normal" },
              { value: "timed", label: "Timed $t$" },
              { value: "boss", label: "Boss round $\\star$", icon: <IconSparkle /> },
            ]}
          />
          <Segmented
            label="Calendar view (all special)"
            value={view}
            onChange={setView}
            special
            segments={[
              { value: "day", label: "Day $d$" },
              { value: "week", label: "Week $7d$" },
              { value: "month", label: "Month $\\approx 30d$" },
            ]}
          />
        </div>
      </Demo>
    </Section>
  );
}

function Pills() {
  return (
    <Section id="pills" title="Pills" path="components/ui/Pill.tsx" note="Status, difficulty, counts and tags.">
      <Demo>
        <div className="flex flex-wrap items-center gap-3">
          <Pill>{"Neutral $n$"}</Pill>
          <Pill tone="accent">{"Accent $a$"}</Pill>
          <Pill tone="green">{"Easy $\\checkmark$"}</Pill>
          <Pill tone="amber">{"Medium $\\sim$"}</Pill>
          <Pill tone="red">{"Hard $\\times$"}</Pill>
          <Pill tone="blue">{"Single choice $\\{a\\}$"}</Pill>
          <Pill tone="ink">{"Q$_{12}$"}</Pill>
          <Pill tone="special">{"Personal best $\\star$"}</Pill>
        </div>
        <Text>
          Keys stay literal: press <Kbd>Esc</Kbd> to close a dialog, $\hookleftarrow$ <Kbd>Enter</Kbd> to check an
          answer.
        </Text>
      </Demo>
    </Section>
  );
}

function TabsDemo() {
  const [tab, setTab] = useState<"overview" | "topics" | "mistakes">("overview");
  const tabs = [
    { value: "overview" as const, label: "Overview $\\Sigma$" },
    { value: "topics" as const, label: "Topics $\\tau$", count: 24 },
    { value: "mistakes" as const, label: "Mistakes $\\times$", count: 7 },
  ];
  return (
    <Section id="tabs" title="Tabs" path="components/ui/Tabs.tsx" note="Arrow keys move between tabs.">
      <Demo>
        <Tabs label="Stats sections" value={tab} onChange={setTab} tabs={tabs} />
        <Text variant="hint">{`Showing: $\\texttt{${tab}}$`}</Text>
      </Demo>
      <Demo caption="Special: one tab, or all of them">
        <Tabs label="Stats sections (one special)" value={tab} onChange={setTab} special={["mistakes"]} tabs={tabs} />
        <Tabs label="Stats sections (all special)" value={tab} onChange={setTab} special tabs={tabs} />
      </Demo>
    </Section>
  );
}

function Cards() {
  return (
    <Section
      id="cards"
      title="Cards & stats"
      path="components/ui/Card.tsx · Progress.tsx"
      note="Hero is the one dark panel: use at most one per screen."
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        <Card
          title="Today: $\frac{1}{4}$ done"
          subtitle="Tuesday · $4$ tasks"
          actions={
            <Button size="sm" variant="soft">
              {"Open $\\nearrow$"}
            </Button>
          }
        >
          {"Cards hold one idea each, e.g. $\\nabla f = 0$."}
        </Card>
        <Card hero title="$12$ days to go" subtitle="Keep the streak alive: $s_{n+1} = s_n + 1$.">
          <Stat value="$86\%$" label="Plan done $\frac{78}{91}$" />
        </Card>
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Stat value="$1{,}248$" label="Questions answered $\sum q$" hint="$+64$ this week" trend="up" />
            <Stat value="$71\%$" label="Accuracy $\frac{r}{n}$" hint="$-3\%$ this week" trend="down" />
          </div>
        </Card>
        <Card special title="Milestone reached $\star$" subtitle="$500$ questions answered">
          {"Special cards get a flowing gradient border and a sparkle. $\\infty$ effort."}
        </Card>
      </div>
    </Section>
  );
}

function ProgressDemo() {
  return (
    <Section id="progress" title="Progress" path="components/ui/Progress.tsx">
      <Demo>
        <ProgressBar label="Today's questions $q_t$" value={7} max={12} />
        <ProgressBar label="Probability accuracy $P(\checkmark)$" value={48} max={100} tone="red" />
        <ProgressBar label="Linear algebra accuracy $\|A\|$" value={81} max={100} tone="green" />
        <ProgressBar label="Coverage $\frac{|T|}{|Q|}$" value={30} max={40} tone="amber" />
        <ProgressBar label="Plan complete (special) $\star$" value={88} max={91} tone="special" />
      </Demo>
    </Section>
  );
}

function Callouts() {
  return (
    <Section
      id="callouts"
      title="Callouts"
      path="components/ui/Callout.tsx"
      note="Caution is for anything the user must NOT do."
    >
      <Demo>
        <Callout tone="info" title="Tip $\to$">
          {"Answers save automatically, every $\\Delta t$."}
        </Callout>
        <Callout tone="success" title="Pack imported $\checkmark$">
          {"$412$ questions across $18$ topics."}
        </Callout>
        <Callout tone="warn" title="$3$ questions skipped">
          {"They had no correct option marked: $|C| = 0$."}
        </Callout>
        <Callout tone="caution" title="Do not clear your browser's site data.">
          {"That deletes everything Orbit has saved: $D \\to \\varnothing$. Back up first."}
        </Callout>
        <Callout tone="special" title="$7$-day streak!">
          {"You practised every day this week: $\\forall d \\in W$."}
        </Callout>
      </Demo>
    </Section>
  );
}

function TableDemo() {
  const cols: Column<TopicRow>[] = [
    { key: "topic", header: "Topic $\\tau$", cell: (r) => r.topic, sortValue: (r) => r.topic },
    {
      key: "answered",
      header: "Answered $n$",
      cell: (r) => `$${r.answered}$`,
      align: "right",
      sortValue: (r) => r.answered,
    },
    {
      key: "accuracy",
      header: "Accuracy $\\frac{r}{n}$",
      align: "right",
      sortValue: (r) => r.accuracy,
      cell: (r) => (
        <Pill
          tone={r.accuracy >= 0.75 ? "green" : r.accuracy >= 0.6 ? "amber" : "red"}
        >{`$${Math.round(r.accuracy * 100)}\\%$`}</Pill>
      ),
    },
    {
      key: "time",
      header: "Avg time $\\bar{t}$",
      cell: (r) => `$${r.time}\\,\\text{s}$`,
      align: "right",
      sortValue: (r) => r.time,
    },
  ];
  const specialCols = cols.map((c) => (c.key === "accuracy" ? { ...c, special: true } : c));
  return (
    <Section
      id="table"
      title="Table"
      path="components/ui/Table.tsx"
      note="Click a header to sort. Scrolls sideways on phones."
    >
      <Table caption="Topics" columns={cols} rows={TOPICS} rowKey={(r) => r.topic} />
      <Text variant="caption" as="span">
        {"Special: a row (best topic) and a column (accuracy $\\frac{r}{n}$)"}
      </Text>
      <Table
        caption="Topics, highlighted"
        columns={specialCols}
        rows={TOPICS}
        rowKey={(r) => r.topic}
        specialRow={(r) => r.topic.startsWith("Linear algebra")}
      />
      <Table
        caption="Empty"
        columns={cols}
        rows={[]}
        rowKey={(r) => r.topic}
        empty="No answers yet: $n = 0$. Start practising to see your topics here."
      />
    </Section>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);
  const [party, setParty] = useState(false);
  return (
    <Section
      id="dialog"
      title="Dialog"
      path="components/ui/Dialog.tsx"
      note="Closes on Esc, on the × button, and on a click outside. The page behind is frosted."
    >
      <Demo>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="danger" icon={<IconTrash />} onClick={() => setOpen(true)}>
            {"Reset stats $\\to 0$"}
          </Button>
          <Button variant="special" icon={<IconSparkle />} onClick={() => setParty(true)}>
            {"Special dialog $\\star$"}
          </Button>
        </div>
        <Dialog
          special
          open={party}
          onClose={() => setParty(false)}
          title="Plan complete! $\frac{91}{91}$"
          footer={
            <Button variant="special" onClick={() => setParty(false)}>
              {"Thanks! $\\heartsuit$"}
            </Button>
          }
        >
          {"You finished every day of your plan: $\\sum_{d=1}^{91} 1 = 91$ days of work."}
          <ProgressBar label="Days done $d$" value={91} max={91} tone="special" />
        </Dialog>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Reset all stats? $S \to \varnothing$"
          footer={
            <>
              <Button variant="soft" onClick={() => setOpen(false)}>
                {"Keep my stats $S$"}
              </Button>
              <Button variant="danger" onClick={() => setOpen(false)}>
                {"Reset stats $\\varnothing$"}
              </Button>
            </>
          }
        >
          {"Your plan, questions and ticks stay. Every answer and every mock result ($\\forall a \\in A$) is deleted."}
          <Callout tone="caution" title="This cannot be undone: $f^{-1}$ does not exist.">
            {"Back up first if you might want them later."}
          </Callout>
        </Dialog>
      </Demo>
    </Section>
  );
}

function ToastDemo() {
  const toast = useToast();
  return (
    <Section
      id="toast"
      title="Toast"
      path="components/ui/Toast.tsx"
      note="Short feedback in the bottom-right corner that never moves the layout. Each slides in, then slides out to the right; toasts above it glide down into the gap. At most $3$ on screen."
    >
      <Demo>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              toast("First of three: $n = 1$");
              setTimeout(() => toast("Second: $n = 2$", "success"), 350);
              setTimeout(() => toast("Third: $n = 3$", "special"), 700);
            }}
          >
            {"Show $3$ in a row"}
          </Button>
          <Button variant="soft" onClick={() => toast("Warm special: $\\Delta T > 0$", "warm")}>
            {"Warm $\\Delta T$"}
          </Button>
          <Button variant="soft" onClick={() => toast("Prompt copied $\\to$ clipboard")}>
            {"Neutral $n$"}
          </Button>
          <Button variant="soft" onClick={() => toast("Plan saved $\\checkmark$", "success")}>
            {"Success $\\checkmark$"}
          </Button>
          <Button
            variant="soft"
            onClick={() => toast("Could not save: storage is full ($100\\%$). Back up and free some space.", "error")}
          >
            {"Error $\\times$"}
          </Button>
          <Button variant="special" onClick={() => toast("New personal best: $\\frac{46}{50} = 92\\%$!", "special")}>
            {"Special $\\star$"}
          </Button>
        </div>
      </Demo>
    </Section>
  );
}

function DividerDemo() {
  const variants = ["solid", "dashed", "dotted", "double", "thick", "accent", "fade", "special"] as const;
  return (
    <Section
      id="dividers"
      title="Dividers"
      path="components/ui/Divider.tsx"
      note="Horizontal lines between sections, with or without a label."
    >
      <Demo caption="Plain">
        {variants.map((v) => (
          <div key={v}>
            <Text variant="caption" as="span">
              {v}
            </Text>
            <Divider variant={v} />
          </div>
        ))}
      </Demo>
      <Demo caption="With a label">
        {variants.map((v) => (
          <Divider key={v} variant={v} label={`${v}: $\\S\\,${variants.indexOf(v) + 1}$`} />
        ))}
        <Divider variant="dashed" label="Aligned to the start: $t_0$" align="start" />
        <Text variant="caption" as="span">
          {"Warm special (inside $\\texttt{<Warm>}$)"}
        </Text>
        <Warm>
          <Divider variant="special" />
          <Divider variant="special" label="Week $2$ · warm" />
        </Warm>
      </Demo>
    </Section>
  );
}

function WarmDemo() {
  const toast = useToast();
  const [tab, setTab] = useState<"a" | "b" | "c">("a");
  const [seg, setSeg] = useState<"x" | "y">("x");
  return (
    <Section
      id="warm"
      title="Warm special"
      path="components/ui/Special.tsx · <Warm>"
      note="Wrap anything in <Warm> and every special style inside it uses the warm gradient (red $\to$ red-orange $\to$ amber) instead of the cool one. Toasts take the tone $\texttt{warm}$."
    >
      <Demo caption="Cool (default) vs warm">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="special" icon={<IconSparkle />}>
            {"Cool $\\nabla$"}
          </Button>
          <Warm inline>
            <Button variant="special" icon={<IconSparkle />}>
              {"Warm $\\Delta$"}
            </Button>
          </Warm>
          <Pill tone="special">{"Cool $\\star$"}</Pill>
          <Warm inline>
            <Pill tone="special">{"Warm $\\star$"}</Pill>
          </Warm>
          <Spinner label="Loading" special />
          <Warm inline>
            <Spinner label="Loading" special />
          </Warm>
        </div>
      </Demo>
      <Warm>
        <Demo caption="Everything special, warm">
          <Heading level={2} special>
            {"On fire: $10$-day streak"}
          </Heading>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="special" icon={<IconSparkle />}>
              {"Keep going $\\to$"}
            </Button>
            <Pill tone="special">{"Hot streak $\\uparrow$"}</Pill>
            <Button variant="soft" onClick={() => toast("Warm toast: $T = 451\\,^\\circ\\text{F}$", "warm")}>
              {"Warm toast"}
            </Button>
          </div>
          <Tabs
            label="Warm tabs"
            value={tab}
            onChange={setTab}
            special={["c"]}
            tabs={[
              { value: "a", label: "Plain" },
              { value: "b", label: "Plain too" },
              { value: "c", label: "Special $\\star$" },
            ]}
          />
          <Segmented
            label="Warm segments"
            value={seg}
            onChange={setSeg}
            special
            segments={[
              { value: "x", label: "Hot $x$" },
              { value: "y", label: "Hotter $y$" },
            ]}
          />
          <ProgressBar label="Warm progress $\frac{9}{10}$" value={9} max={10} tone="special" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            <Card special title="Warm card $\star$" subtitle="Gradient border, warm sparkle">
              {"Heat equation: $u_t = \\alpha\\,u_{xx}$."}
            </Card>
            <Callout tone="special" title="Warm callout">
              {"Same component, warm colours: $\\text{red} \\to \\text{orange}$."}
            </Callout>
          </div>
          <Divider variant="special" label="Warm divider" />
          <Table
            caption="Warm table"
            rowKey={(r) => r.k}
            specialRow={(r) => r.k === "b"}
            rows={[
              { k: "a", name: "Normal row", v: "$1$" },
              { k: "b", name: "Special row", v: "$2$" },
              { k: "c", name: "Normal row", v: "$3$" },
            ]}
            columns={[
              { key: "n", header: "Row", cell: (r) => r.name },
              { key: "v", header: "Special column $v$", cell: (r) => r.v, special: true, align: "right" },
            ]}
          />
          <McqQuestion
            special
            number={7}
            question={{ ...Q_MCQ, id: "q_warm" }}
            detail={{ question_id: "q_warm", options: ["$0$", "$1$", "$3$", "$-1$"], correct: 1 }}
          />
        </Demo>
      </Warm>
    </Section>
  );
}

function EmptyDemo() {
  return (
    <Section
      id="empty"
      title="Empty state"
      path="components/ui/EmptyState.tsx"
      note="Say why it is empty and offer the next step."
    >
      <EmptyState
        title="No question pack yet: $|Q| = 0$"
        action={
          <Button variant="primary" icon={<IconUpload />}>
            {"Import a pack $\\uparrow$"}
          </Button>
        }
      >
        {
          "Import a question pack to start practising. You can make one with any AI chat, maths like $\\frac{a}{b}$ included."
        }
      </EmptyState>
    </Section>
  );
}

function RichDemo() {
  const toast = useToast();
  const [space, setSpace] = useState<"r" | "c" | "b">("r");
  const [dist, setDist] = useState<string | null>("n");
  const [chk, setChk] = useState(false);
  return (
    <Section
      id="rich"
      title="Markdown & maths"
      path="components/ui/Rich.tsx · lib/markdown.ts"
      note="What every piece of text renders through. Raw HTML is shown as text, never run."
    >
      <Demo>
        <Rich
          block
          text={
            "### Quadratic formula\nThe roots of $ax^2 + bx + c = 0$ are:\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n" +
            "**Bold**, *italic*, ++underlined++, ~~struck~~ and `inline code`.\n\n1. Numbered\n2. List\n\n> A quote with maths: $e^{i\\pi} + 1 = 0$\n\n" +
            '```python\nprint("code block")\n```\n\nA price of \\$5 stays plain text, and <b>tags</b> stay as text.'
          }
        />
      </Demo>
      <Demo caption="Mixed: every component renders its text as markdown + maths, automatically">
        <Heading level={3}>{"Accuracy on $P(A \\mid B)$ questions, **this week**"}</Heading>
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone="red">{"**Hard** · $O(n \\log n)$"}</Pill>
          <Button variant="soft">{"Solve $x^2 = 4$"}</Button>
          <Button variant="soft" onClick={() => toast("Saved *notes* for $\\int_0^1 x\\,dx$", "success")}>
            {"Toast with maths $\\int$"}
          </Button>
          <Tooltip content="Tooltip with **bold** and $\sqrt{2}$">
            <Button variant="ghost">{"Hover me $\\sqrt{2}$"}</Button>
          </Tooltip>
        </div>
        <Tabs
          label="Spaces"
          value={space}
          onChange={setSpace}
          tabs={[
            { value: "r", label: "$\\mathbb{R}^n$" },
            { value: "c", label: "$\\mathbb{C}^n$" },
            { value: "b", label: "**Bold** tab" },
          ]}
        />
        <Table
          caption="Formulas"
          rowKey={(r) => r.name}
          rows={[
            { name: "Mean", f: "$\\bar{x} = \\frac{1}{n}\\sum x_i$", note: "*average*" },
            { name: "Variance", f: "$\\sigma^2 = E[(X-\\mu)^2]$", note: "spread, **squared**" },
          ]}
          columns={[
            { key: "n", header: "**Name**", cell: (r) => r.name },
            { key: "f", header: "Formula $f$", cell: (r) => r.f },
            { key: "x", header: "Note", cell: (r) => r.note },
          ]}
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <Dropdown
            label="Pick a distribution $X$"
            value={dist}
            onChange={setDist}
            options={[
              { value: "n", label: "Normal $\\mathcal{N}(\\mu, \\sigma^2)$", description: "Bell curve" },
              { value: "b", label: "Binomial $B(n, p)$", description: "$n$ trials, success chance $p$" },
            ]}
          />
          <Checkbox
            checked={chk}
            onChange={setChk}
            label="Show $\LaTeX$ source"
            description="Turns *every* formula back into text."
          />
        </div>
      </Demo>
    </Section>
  );
}

function Questions() {
  return (
    <Section
      id="questions"
      title="Questions"
      path="components/question/*"
      note="One component per question type, all sharing QuestionFrame. Try answering them: the verdict and explanation have maths too."
    >
      <McqQuestion
        number={1}
        question={Q_MCQ}
        detail={{ question_id: Q_MCQ.id, options: ["$0$", "$1$", "$3$", "$-1$"], correct: 1 }}
      />
      <MsqQuestion
        number={2}
        question={Q_MSQ}
        detail={{
          question_id: Q_MSQ.id,
          options: ["$|x|$", "$\\frac{1}{x}$", "$x^2$", "$\\lfloor x \\rfloor$"],
          correct: [0, 2],
        }}
      />
      <NatQuestion number={3} question={Q_NAT} detail={{ question_id: Q_NAT.id, value: 1.72, tolerance: 0.01 }} />
      <StrQuestion
        number={4}
        question={Q_STR}
        detail={{ question_id: Q_STR.id, match: "set", case_sensitive: false, accepted: ["2, 3, 5, 7"] }}
      />
      <CodeQuestion
        number={5}
        question={Q_CODE}
        detail={{ question_id: Q_CODE.id, starter: "def is_palindrome(s):\n  # your code here\n  pass\n" }}
      />
      <Text variant="caption" as="span">
        {"Special question (e.g. question of the day $\\star$)"}
      </Text>
      <McqQuestion
        special
        number={6}
        question={{ ...Q_MCQ, id: "q_mcq2" }}
        detail={{ question_id: "q_mcq2", options: ["$0$", "$1$", "$3$", "$-1$"], correct: 1 }}
      />
    </Section>
  );
}
