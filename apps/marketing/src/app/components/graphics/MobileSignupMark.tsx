import { MacroMarkIcon } from './MacroMarkIcon';

/**
 * The Macro mark on a rounded tile, linking home. Heads the phone signup
 * pages, which have no site header.
 */
export function MobileSignupMark() {
  return (
    <>
      <style>{`
        .mobile-signup-mark {
          align-items: center;
          background: linear-gradient(145deg, #171717, #090909 65%);
          border-radius: 18px;
          box-shadow: inset .5px .5px 1px #ffffff1c, inset -.5px -.5px 1px #0008, 0 1px 1px #131313, 0 4px 10px #0005;
          color: var(--a0);
          display: flex;
          height: 64px;
          justify-content: center;
          width: 64px;
        }
        html[data-palette='cream'] .mobile-signup-mark {
          background: linear-gradient(145deg, #fefdfb, #ece7dd 70%);
          box-shadow: inset 0 1px 0 #fff, 0 0 0 1px #1d1c1a12, 0 1px 1px #1d1c1a0d, 0 6px 14px -6px #1d1c1a2e;
        }
      `}</style>
      {/* `rel="external"` makes this a full page load: `/` is its own
          prerendered document, not a route in this router. */}
      <a href="/" rel="external" class="mobile-signup-mark" aria-label="Macro home">
        <MacroMarkIcon style={{ height: '22px', width: '34px' }} />
      </a>
    </>
  );
}
