import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">404</span>
          <h1>That page does not exist.</h1>
          <p>The route may have moved, or the content may not be published.</p>
        </div>
      </div>
      <div className="button-row">
        <Link className="primary-button" href="/">
          Back to overview
        </Link>
        <Link className="secondary-button" href="/learn">
          How it works
        </Link>
      </div>
    </>
  );
}
