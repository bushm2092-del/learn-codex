type Step = { title: string; detail: string };

export function ToolExecutionFlow({ label, steps }: { label: string; steps: readonly Step[] }) {
  return (
    <figure className="tool-execution-flow" aria-label={label}>
      <ol>
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="tool-execution-flow__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <figcaption>{label}</figcaption>
    </figure>
  );
}
