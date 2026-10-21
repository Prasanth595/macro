import { useProfilePictureEditorSource } from './queries/profile-picture-source';
import ProfilePictureEditor from './views/profile-picture-editor';

export default function ProfilePictureSession(props: {
  userId: string;
  onClose: () => void;
}) {
  const source = useProfilePictureEditorSource(props.userId);
  return (
    <ProfilePictureEditor
      userId={props.userId}
      pictureUrl={source.pictureUrl()}
      writer={source.writer}
      onClose={props.onClose}
    />
  );
}
