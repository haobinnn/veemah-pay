import React from "react";

export function Table({ headers, rows }:{ headers: string[]; rows: (React.ReactNode[])[] }){
  return (
    <table className="table zebra">
      <thead>
        <tr>
          {headers.map((h,i) => <th key={i}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r,ri) => (
          <tr key={ri}>{r.map((c,ci) => <td key={ci}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

