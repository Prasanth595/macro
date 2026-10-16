import { ComposeSubjectField } from '../components/compose-subject-field';
import { useCompose } from '../context/compose-context';

export function ComposeSubject(props: {
  inputRef?: (el: HTMLElement) => void;
}) {
  const ctx = useCompose();
  return (
    <ComposeSubjectField
      value={ctx.subject()}
      onChange={ctx.setSubject}
      disabled={ctx.disabled()}
      compact={ctx.isMobile()}
      error={ctx.validationError('no_subject')?.message}
      inputRef={props.inputRef}
    />
  );
}
