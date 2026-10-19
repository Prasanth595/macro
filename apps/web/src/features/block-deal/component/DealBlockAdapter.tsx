import { Deal } from '@app/features/crm/views/deal-detail';
import { useSplitLayout } from '@components/app/split-layout/layout';
import { CrmProvider } from '@app/features/crm/context/crm-context';
import { createAppCrmContext } from '@app/features/crm/crm-adapter';
import { useBlockId } from '@core/block';

/** Opens the deal ficha from a mention, a comment, or the command menu. */
export function DealBlockAdapter() {
  const dealId = useBlockId();
  const layout = useSplitLayout();
  return (
    <CrmProvider value={createAppCrmContext()}>
      <Deal
        dealId={dealId}
        onOpenCompany={(id) => {
          layout.openWithSplit({ type: 'company', id });
        }}
        onOpenContact={(id) => {
          layout.openWithSplit({ type: 'contact', id });
        }}
      />
    </CrmProvider>
  );
}
