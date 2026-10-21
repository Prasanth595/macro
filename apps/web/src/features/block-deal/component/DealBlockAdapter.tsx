import { Deal } from '@app/features/crm/crm-deal';
import { useSplitLayout } from '@components/app/split-layout/layout';
import { useBlockId } from '@core/block';

/** Opens the deal page from a mention, a comment, or the command menu. */
export function DealBlockAdapter() {
  const dealId = useBlockId();
  const layout = useSplitLayout();
  return (
    <Deal
      dealId={dealId}
      onOpenCompany={(id) => {
        layout.openWithSplit({ type: 'company', id });
      }}
      onOpenContact={(id) => {
        layout.openWithSplit({ type: 'contact', id });
      }}
    />
  );
}
