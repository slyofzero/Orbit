import { BdTable, MockRow, TYPE_COLS, typeBreakdown } from "@/lib/typeBreakdown";
import type { PackData } from "@/lib/packs";

const cell = (n: number) => (n === 0 ? <span className="bd-zero">·</span> : n);

function Table({ title, note, t, first }: { title: string; note: string; t: BdTable; first: string }) {
  return (
    <div className="bd-block">
      <h3>{title}</h3>
      <p className="small muted">{note}</p>
      <div className="bd-scroll">
        <table className="bd">
          <thead><tr><th>{first}</th>{TYPE_COLS.map((c) => <th key={c.type}>{c.label}</th>)}<th>Total</th><th>Marks</th></tr></thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.key}>
                <td><span className="bd-name">{r.name}</span>{r.subject && <small className="muted"> {r.subject}</small>}</td>
                {TYPE_COLS.map((c) => <td key={c.type}>{cell(r.counts[c.type])}</td>)}
                <td><b>{r.total}</b></td><td>{r.marks}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td>{TYPE_COLS.map((c) => <td key={c.type}>{t.totals.counts[c.type]}</td>)}<td>{t.totals.total}</td><td>{t.totals.marks}</td></tr></tfoot>
        </table>
      </div>
      {t.topicsWithout > 0 && <p className="small muted" style={{ margin: "4px 0 0" }}>{t.topicsWithout} topic{t.topicsWithout === 1 ? " has" : "s have"} no questions here.</p>}
    </div>
  );
}

function MockTable({ rows }: { rows: MockRow[] }) {
  return (
    <div className="bd-scroll">
      <table className="bd">
        <thead><tr><th>Mock test</th>{TYPE_COLS.map((c) => <th key={c.type}>{c.label}</th>)}<th>Total</th><th>Marks</th><th>Minutes</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td><span className="bd-name">{r.name}</span><small className="muted"> {r.sections} section{r.sections === 1 ? "" : "s"}</small></td>{TYPE_COLS.map((c) => <td key={c.type}>{cell(r.counts[c.type])}</td>)}<td><b>{r.total}</b></td><td>{r.marks}</td><td>{r.minutes}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** What a pack file holds: two tables, practice and mocks, with one row per topic and one column per question type. */
export default function PackBreakdown({ pack }: { pack: PackData }) {
  const b = typeBreakdown(pack);
  return (
    <div className="bd-wrap">
      <Table title="Practice questions" note="Per topic and question type. These go to the Practice page." t={b.practice} first="Topic" />
      {b.mock.totals.total > 0 ? (
        <>
          <Table title="Mock-test questions" note="Per topic and question type, across all mock tests. They stay out of Practice." t={b.mock} first="Topic" />
          <div className="bd-block"><h3>Mock tests</h3><MockTable rows={b.mocks} /></div>
        </>
      ) : (
        <div className="bd-block"><h3>Mock-test questions</h3><p className="small muted" style={{ margin: 0 }}>This file has no mock tests.</p></div>
      )}
    </div>
  );
}
