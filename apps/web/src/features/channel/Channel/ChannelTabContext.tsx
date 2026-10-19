import {
  type Accessor,
  createContext,
  type ParentProps,
  useContext,
} from 'solid-js';
import type { ChannelInfoTab, ChannelTabId } from './channel-tabs';

export type ChannelInfoPanelState = {
  id: string;
  isOpen: Accessor<boolean>;
  activeTab: Accessor<ChannelInfoTab>;
  toggle: () => void;
  close: () => void;
  setActiveTab: (tab: ChannelInfoTab) => void;
  triggerRef: (element: HTMLButtonElement) => void;
};

type ChannelTabContextValue = {
  activeTab: Accessor<ChannelTabId>;
  setActiveTab: (tab: ChannelTabId) => void;
  infoPanel?: ChannelInfoPanelState;
};

const ChannelTabContext = createContext<ChannelTabContextValue>();

export function ChannelTabProvider(
  props: ParentProps<{
    activeTab: Accessor<ChannelTabId>;
    setActiveTab: (tab: ChannelTabId) => void;
    infoPanel?: ChannelInfoPanelState;
  }>
) {
  return (
    <ChannelTabContext.Provider
      value={{
        activeTab: props.activeTab,
        setActiveTab: props.setActiveTab,
        infoPanel: props.infoPanel,
      }}
    >
      {props.children}
    </ChannelTabContext.Provider>
  );
}

export function useChannelTab(): ChannelTabContextValue {
  const ctx = useContext(ChannelTabContext);
  if (!ctx) {
    throw new Error('useChannelTab must be used within <ChannelTabProvider>');
  }
  return ctx;
}
