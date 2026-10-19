import type { JSX } from 'solid-js';

export function HomepageFeatureHeading(props: {
  id: string;
  title: string;
  description: string;
  children?: JSX.Element;
}) {
  return (
    <header class="homepage-feature-heading homepage-enter workspace-demo">
      <div class="homepage-feature-heading-row">
        <span class="homepage-heading-rule" aria-hidden="true" />
        <div class="homepage-feature-title">
          {props.children}
          <h2 id={props.id}>{props.title}</h2>
        </div>
        <span class="homepage-heading-rule" aria-hidden="true" />
      </div>
      <div class="homepage-section-break">
        <p>{props.description}</p>
      </div>
    </header>
  );
}
