import React, { useCallback, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { CircleX, PlayCircle } from 'lucide-react';
import { sdpppSDK } from '@sdppp/common';
import { buildBoundaryUri } from '@sdppp/resourcing/src/resource-uris';
import { useTranslation } from '@sdppp/common';
import { useUploadPasses } from '../../../../../base/upload-pass-context';
import { ComfyTask } from '../../../../ComfyTask';

const ICON_SIZE = 16;
const PRIMARY_ICON_SIZE = 32;

const runAndWaitResult = async (multi: number, currentWorkflow: string): Promise<ComfyTask> => {
  const activeDocumentID = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID ?? 0;
  const webviewState = sdpppSDK.stores.WebviewStore.getState();
  const boundaryRect = webviewState?.workBoundaries?.[activeDocumentID] ?? null;
  const sizeLimit = webviewState?.workBoundaryMaxSizes?.[activeDocumentID];
  const imageQuality = webviewState?.workBoundaryImageQualities?.[activeDocumentID];
  const boundaryUri = buildBoundaryUri(activeDocumentID, boundaryRect ?? null, {
    imageSize: typeof sizeLimit === 'number' && Number.isFinite(sizeLimit) && sizeLimit > 0
      ? Math.round(sizeLimit)
      : undefined,
    imageQuality: typeof imageQuality === 'number' && Number.isFinite(imageQuality)
      ? Math.round(imageQuality)
      : undefined
  });

  const task = new ComfyTask({ size: multi }, currentWorkflow, activeDocumentID, boundaryUri, null);

  task.promise.catch(error => {
    console.error('ComfyUI task failed:', error);
  });

  return task;
};

interface RunButtonProps {
  currentWorkflow: string;
  setUploading: (uploading: boolean) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

interface RunMultiButtonsProps extends RunButtonProps {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const StopAndCancelButton: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const onClearAndInterrupt = useCallback(() => {
    sdpppSDK.plugins.ComfyCaller.stopAll({});
  }, []);
  return (
    <Tooltip title={translate('comfy.stop_cancel_all')}>
      <Button
        className={className}
        icon={<CircleX size={ICON_SIZE} />}
        danger
        onClick={onClearAndInterrupt}
      />
    </Tooltip>
  );
};

export const RunButton: React.FC<RunButtonProps> = ({
  currentWorkflow,
  setUploading,
  onMouseEnter,
  onMouseLeave,
}) => {
  const { t } = useTranslation();
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const { waitAllUploadPasses } = useUploadPasses();
  const [isDisabled, setIsDisabled] = useState(false);

  const doRun = useCallback(async () => {
    setIsDisabled(true);
    setTimeout(() => setIsDisabled(false), 500);

    setUploading(true);
    await waitAllUploadPasses();
    setUploading(false);

    await runAndWaitResult(1, currentWorkflow);
  }, [waitAllUploadPasses, setUploading, currentWorkflow]);

  return (
    <Tooltip title={translate('comfy.run')}>
      <Button
        type="primary"
        icon={<PlayCircle size={PRIMARY_ICON_SIZE} />}
        onClick={doRun}
        disabled={isDisabled}
        className="workflow-main-action-button workflow-detail-run-button"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    </Tooltip>
  );
};

export const RunMultiButtons: React.FC<RunMultiButtonsProps> = ({
  currentWorkflow,
  setUploading,
  onMouseEnter,
  onMouseLeave,
}) => {
  const { waitAllUploadPasses } = useUploadPasses();
  const [disabledButtons, setDisabledButtons] = useState<Set<number>>(new Set());

  const doRun = useCallback(async (multi: number) => {
    setDisabledButtons(prev => new Set(prev).add(multi));
    setTimeout(() => {
      setDisabledButtons(prev => {
        const newSet = new Set(prev);
        newSet.delete(multi);
        return newSet;
      });
    }, 500);

    setUploading(true);
    await waitAllUploadPasses();
    setUploading(false);
    const task = await runAndWaitResult(multi, currentWorkflow);
    task.promise.finally(() => undefined);
  }, [waitAllUploadPasses, setUploading, currentWorkflow]);

  const renderMultiplierButton = (multi: number) => (
    <Button
      key={multi}
      className="workflow-secondary-button"
      onClick={() => doRun(multi)}
      disabled={disabledButtons.has(multi)}
      size="small"
    >
      x{multi}
    </Button>
  );

  return (
    <div
      className="workflow-controls-secondary-row"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {[2, 5, 9].map(renderMultiplierButton)}
    </div>
  );
};
