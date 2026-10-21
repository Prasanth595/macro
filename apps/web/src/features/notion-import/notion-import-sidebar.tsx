import { openChatWithMessage } from '@app/features/chat/ChatWithAgentButton';
import { useUserId } from '@core/context/user';
import { fireAndForget } from '@core/util/fireAndForget';
import NotionIcon from '@icon/mcp-notion.svg';
import XIcon from '@phosphor/x.svg';
import { queryReadyGate } from '@queries/gate';
import { useNotionImportReportQuery } from '@queries/import';
import { Button } from '@ui';
import { Show } from 'solid-js';
import {
  hideNotionImportPromotion,
  isNotionImportPromotionHidden,
} from './primitives/promotion';

/** The first prompt of the chat that runs the import through the agent. */
const NOTION_IMPORT_PROMPT = 'Import my Notion workspace into Macro.';

/** Offers a Notion import until the user starts one or dismisses the card. */
export function NotionImportSidebar() {
  const report = useNotionImportReportQuery();
  const userId = useUserId();
  const neverStarted = () => queryReadyGate(report) && !report.data.status;

  return (
    <Show when={neverStarted() && !isNotionImportPromotionHidden(userId())}>
      <div class="px-(--sidebar-gutter) py-2">
        <section class="w-full rounded-xl border border-edge-muted bg-control px-2 py-3">
          <div class="flex items-start gap-2.5">
            <NotionIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
            <div class="min-w-0 flex-1">
              <h2 class="text-xs font-medium text-ink">
                Bring Notion to Macro
              </h2>
              <p class="mt-1 text-xs leading-relaxed text-ink-muted">
                Bring over pages and databases.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss Notion import"
              onClick={() => hideNotionImportPromotion(userId())}
            >
              <XIcon class="size-3.5" aria-hidden="true" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            class="mt-3 w-full"
            onClick={() =>
              fireAndForget(
                openChatWithMessage(NOTION_IMPORT_PROMPT),
                'notion-import'
              )
            }
          >
            Import from Notion
          </Button>
        </section>
      </div>
    </Show>
  );
}
