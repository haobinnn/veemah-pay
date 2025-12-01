"use client";
import React from "react";

export function StepWizard({ steps, current, onNext, onPrev }:{ steps: React.ReactNode[]; current: number; onNext: () => void; onPrev: () => void }){
  const total = steps.length;
  return (
    <div className="stepper">
      <div className="stepper-head">
        {steps.map((_,i) => (
          <div key={i} className={`step ${i <= current ? "active" : ""}`}>{i+1}</div>
        ))}
      </div>
      <div className="stepper-body">
        {steps[current]}
      </div>
      <div className="stepper-actions">
        <button className="btn" onClick={onPrev} disabled={current===0}>Back</button>
        <button className="btn primary" onClick={onNext} disabled={current>=total-1}>Next</button>
      </div>
    </div>
  );
}

