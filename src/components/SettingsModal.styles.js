export const styles = `
          .settings-modal {
            width: min(720px, 96vw);
            max-height: min(86vh, 100dvh - 32px);
            overflow: hidden;             /* hide any accidental overflow */
            overflow-y: auto;             /* vertical scroll only */
            box-sizing: border-box;
          }
          .settings-modal__header { gap: 8px; }
          .settings-modal__tabs {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 10px;
          }
          .settings-modal__tabs .tab {
            flex: 1 1 140px;              /* wrap gracefully on small screens */
            text-align: center;
            white-space: nowrap;
          }
          .settings-modal__body {
            overflow-wrap: anywhere;      /* long words/URLs won't force overflow */
          }

          /* generic responsive row used across sections */
          .settings-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            min-width: 0;
            flex-wrap: nowrap;
          }
          .settings-row.wrap { flex-wrap: wrap; }

          .settings-row__left {
            display: flex; align-items: center; gap: 12px; min-width: 0;
          }
          .settings-row__right {
            display: flex; align-items: center; gap: 8px; flex: 0 0 auto;
          }

          .settings-text {
            flex: 1 1 240px;
            min-width: 0;                 /* allow shrink inside flex row */
            width: auto;
          }

          .settings-avatar {
            width: 36px; height: 36px; border-radius: 999px;
            object-fit: cover;
            background: var(--border);
            display: grid; place-items: center; font-size: 14px; opacity: .9;
          }
          .settings-avatar.ph { background: var(--border); }

          .settings-chiprow {
            display: flex; gap: 8px; flex-wrap: wrap;
          }

          /* Mobile hardening */
          @media (max-width: 900px){
            .settings-modal {
              width: calc(100vw - 24px);  /* safe gutters on both sides */
              max-width: 100vw;
              border-radius: 12px;
              margin: 0;
            }
            .settings-modal__tabs .tab {
              flex: 1 1 45%;
            }
            .settings-row {
              flex-wrap: wrap;             /* stack controls when narrow */
            }
            .settings-row__right {
              width: 100%;
              justify-content: flex-end;
            }
          }

          @media (max-width: 480px){
            .settings-modal { width: calc(100vw - 16px); border-radius: 10px; }
            .settings-modal__tabs .tab { flex: 1 1 100%; }
          }
`;

