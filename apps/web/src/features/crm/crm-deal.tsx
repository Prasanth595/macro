import type { ComponentProps } from 'solid-js';
import { CrmProvider } from './context/crm-context';
import { createAppCrmContext } from './crm-adapter';
import { Deal as View } from './views/deal-detail';

/** The deal page for hosts outside CRM. The view stays private to this feature. */
export function Deal(props: ComponentProps<typeof View>) {
  return (
    <CrmProvider value={createAppCrmContext()}>
      <View {...props} />
    </CrmProvider>
  );
}
