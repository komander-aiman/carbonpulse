"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">Something went wrong</span>
          <h1>This view could not load.</h1>
          <p>
            No values are fabricated when a read fails. Retry, or start from a different section. Nothing has been
            changed.
          </p>
        </div>
      </div>
      <div className="button-row">
        <button className="primary-button" type="button" onClick={reset}>
          Try again
        </button>
      </div>
    </>
  );
}
