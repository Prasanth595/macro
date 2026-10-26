import LinkIcon from '@phosphor/link.svg';
import { CopyButton } from '@ui';
import { useCrmContext } from '../context/crm-context';

export function CrmCopyLinkButton(props: {
  id: string;
  type: 'company' | 'contact';
  grouped?: boolean;
}) {
  const { copyRecordLink } = useCrmContext();
  const copyLink = () => copyRecordLink({ type: props.type, id: props.id });

  return (
    <CopyButton aria-label={`Copy ${props.type} link`}
      grouped={props.grouped}
      variant="ghost"
      size={props.grouped ? 'icon-sm' : 'icon-md'}
      
      tooltip={`Copy ${props.type} link`}
      onClick={copyLink}
    >
      <LinkIcon class="size-3.5!" />
    </CopyButton>
  );
}
