import { Alert, Flex, Spin } from 'antd';
import { useEffect, useState, type ComponentType } from 'react';
import { MainStore } from '../../tsx/App.store';

type MainState = ReturnType<typeof MainStore.getState>;
type OfficialProvider = 'RunningHub' | 'SDPPPSponsor';

interface VendorStoreState {
  provider: string;
  previewImageList: MainState['previewImageList'];
  showingPreview: boolean;
  previewError: string;
}

interface VendorStore {
  getState: () => VendorStoreState;
  setState: (state: Partial<VendorStoreState>) => void;
  subscribe: (
    listener: (state: VendorStoreState, previous: VendorStoreState) => void,
  ) => () => void;
}

interface OfficialV2Module {
  RunningHubRenderer: ComponentType<{ showingPreview?: boolean }>;
  SponsorRenderer: ComponentType<{ showingPreview?: boolean }>;
  SponsorMainStore: VendorStore;
}

const vendorPath = './sdppp-v2-vendor.js';
let vendorPromise: Promise<OfficialV2Module> | null = null;

function loadOfficialV2() {
  vendorPromise ??= import(/* @vite-ignore */ vendorPath) as Promise<OfficialV2Module>;
  return vendorPromise;
}

function OfficialV2Renderer({
  provider,
  showingPreview,
}: {
  provider: OfficialProvider;
  showingPreview: boolean;
}) {
  const [vendor, setVendor] = useState<OfficialV2Module | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadOfficialV2().then((module) => {
      if (active) setVendor(module);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!vendor) return;

    const store = vendor.SponsorMainStore;
    let syncing = false;
    const copyLocalToVendor = (state: MainState) => store.setState({
      provider: state.provider,
      previewImageList: state.previewImageList,
      showingPreview: state.showingPreview,
      previewError: state.previewError,
    });

    copyLocalToVendor(MainStore.getState());

    const unsubscribeVendor = store.subscribe((state, previous) => {
      if (syncing || (
        state.previewImageList === previous.previewImageList
        && state.showingPreview === previous.showingPreview
        && state.previewError === previous.previewError
      )) return;

      syncing = true;
      MainStore.setState({
        previewImageList: state.previewImageList,
        showingPreview: state.showingPreview,
        previewError: state.previewError,
      });
      syncing = false;
    });

    const unsubscribeLocal = MainStore.subscribe((state, previous) => {
      if (syncing || (
        state.provider === previous.provider
        && state.previewImageList === previous.previewImageList
        && state.showingPreview === previous.showingPreview
        && state.previewError === previous.previewError
      )) return;

      syncing = true;
      copyLocalToVendor(state);
      syncing = false;
    });

    return () => {
      unsubscribeVendor();
      unsubscribeLocal();
      store.setState({ provider: '' });
    };
  }, [vendor]);

  if (error) return <Alert type="error" showIcon message={error} />;
  if (!vendor) return <Flex justify="center"><Spin size="small" /></Flex>;

  const Renderer = provider === 'RunningHub'
    ? vendor.RunningHubRenderer
    : vendor.SponsorRenderer;
  return <Renderer showingPreview={showingPreview} />;
}

export function RunningHubV2Renderer({ showingPreview }: { showingPreview: boolean }) {
  return <OfficialV2Renderer provider="RunningHub" showingPreview={showingPreview} />;
}

export function SponsorV2Renderer({ showingPreview }: { showingPreview: boolean }) {
  return <OfficialV2Renderer provider="SDPPPSponsor" showingPreview={showingPreview} />;
}
