import React from 'react'
import { useAppStore } from '../../stores/appStore'
import { Section, Row, Stepper, Button, Toggle, NumberInput, Select } from './UIKit'
import { formatCount, useTranslation } from '../../i18n'
import type { Cell } from '../../../shared/types'

export const GridControls: React.FC = () => {
  const {
    grid,
    cells,
    selectedCellId,
    addColumn,
    removeColumn,
    addRow,
    removeRow,
    setCellFolder,
    setAllCellsFolder,
    setCellSlideshow,
    setAllCellsSlideshow,
    setCellImageFit,
    setAllCellsImageFit,
    restartSlideshowsRandomly,
    resetCellFolder,
    resetAllCellFolders,
  } = useAppStore()
  const { language, t } = useTranslation()

  const selectedCell = cells.find(c => c.id === selectedCellId)

  const handleOpenFolder = async () => {
    if (!selectedCellId) return
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    const result = await api.openFolder(language)
    if (result.canceled || !result.folderPath || !result.images) return
    setCellFolder(selectedCellId, {
      id: `folder-${Date.now()}`,
      path: result.folderPath,
      images: result.images,
    })
  }

  const transitionOptions = [
    { value: 'none', label: t('transitionNone') },
    { value: 'fade', label: t('transitionFade') },
    { value: 'slide-left', label: t('transitionSlideLeft') },
    { value: 'slide-right', label: t('transitionSlideRight') },
    { value: 'slide-up', label: t('transitionSlideUp') },
    { value: 'slide-down', label: t('transitionSlideDown') },
    { value: 'zoom-in', label: t('transitionZoomIn') },
    { value: 'zoom-out', label: t('transitionZoomOut') },
  ]

  return (
    <div>
      <Section title={t('gridSize')}>
        <Row label={t('colLabel')}>
          <Stepper value={grid.cols} min={1} max={15} onDecrement={removeColumn} onIncrement={addColumn} onDecrementAtMin={resetAllCellFolders} label={t('colUnit')} />
        </Row>
        <Row label={t('rowLabel')}>
          <Stepper value={grid.rows} min={1} max={15} onDecrement={removeRow} onIncrement={addRow} onDecrementAtMin={resetAllCellFolders} label={t('rowUnit')} />
        </Row>
      </Section>

      <Section title={t('selectedCell')}>
        {!selectedCellId ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '12px 0' }}>
            {t('selectCellHelp')}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
              {t('cell')} [{selectedCell ? selectedCell.col + 1 : '-'}, {selectedCell ? selectedCell.row + 1 : '-'}]
              {selectedCell?.folder ? ` / ${formatCount(language, selectedCell.folder.images.length, t('imagesUnit'))}` : ` / ${t('folderNotSet')}`}
            </div>

            <Row label={t('imageFit')}>
              <Select
                value={selectedCell?.imageFit ?? 'cover'}
                options={[
                  { value: 'fitHeight', label: t('fitHeight') },
                  { value: 'fitWidth', label: t('fitWidth') },
                  { value: 'cover', label: t('cover') },
                ]}
                onChange={v => setCellImageFit(selectedCellId, v as NonNullable<typeof selectedCell>['imageFit'])}
              />
            </Row>

            <div style={{ marginBottom: 8 }}>
              <Button
                variant="secondary"
                onClick={() => setAllCellsImageFit(selectedCell?.imageFit ?? 'cover')}
              >
                {t('applyImageFitAll')}
              </Button>
            </div>

            <Button variant="primary" onClick={handleOpenFolder}>
              {t('selectFolder')}
            </Button>

            {selectedCell?.folder && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginBottom: 8, wordBreak: 'break-all' }}>
                  {selectedCell.folder.path}
                </div>
                <Button variant="secondary" onClick={() => setAllCellsFolder(selectedCell.folder!)}>
                  {t('applyFolderAll')}
                </Button>

                <Section title={t('slideshow')}>
                  <Row label={t('enabled')}>
                    <Toggle
                      value={selectedCell.slideshow.enabled}
                      onChange={v => setCellSlideshow(selectedCellId, { enabled: v })}
                    />
                  </Row>
                  {selectedCell.slideshow.enabled && (
                    <>
                      <Row label={t('interval')}>
                        <NumberInput
                          value={selectedCell.slideshow.intervalMs / 1000}
                          min={1}
                          max={3600}
                          step={1}
                          unit={t('seconds')}
                          onChange={v => setCellSlideshow(selectedCellId, { intervalMs: v * 1000 })}
                        />
                      </Row>
                      <Row label={t('random')}>
                        <Toggle
                          value={selectedCell.slideshow.randomOrder}
                          onChange={v => setCellSlideshow(selectedCellId, { randomOrder: v })}
                        />
                      </Row>
                      <Row label={t('transitionEffect')}>
                        <Select
                          value={selectedCell.slideshow.transition}
                          options={transitionOptions}
                          onChange={v => setCellSlideshow(selectedCellId, { transition: v as Cell['slideshow']['transition'] })}
                        />
                      </Row>
                      <Row label={t('transitionDuration')}>
                        <NumberInput
                          value={selectedCell.slideshow.transitionDurationMs / 1000}
                          min={0.1}
                          max={3}
                          step={0.05}
                          unit={t('seconds')}
                          onChange={v => setCellSlideshow(selectedCellId, { transitionDurationMs: v * 1000 })}
                        />
                      </Row>
                    </>
                  )}
                  <Button variant="secondary" onClick={() => setAllCellsSlideshow(selectedCell.slideshow)}>
                    {t('applySlideshowAll')}
                  </Button>
                  <div style={{ marginTop: 8 }}>
                    <Button
                      variant="secondary"
                      onClick={restartSlideshowsRandomly}
                      disabled={!cells.some(cell => cell.slideshow.enabled && cell.folder && cell.folder.images.length > 1)}
                    >
                      {t('restartRandomTiming')}
                    </Button>
                  </div>
                </Section>
              </div>
            )}
          </>
        )}
      </Section>

      <Section title={t('cellsList')}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
          {formatCount(language, cells.length, t('cell'))} / {formatCount(language, grid.cols, t('colUnit'))} x {formatCount(language, grid.rows, t('rowUnit'))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {cells.map(cell => (
            <div
              key={cell.id}
              onClick={() => useAppStore.getState().selectCell(cell.id)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 10,
                cursor: 'pointer',
                background: cell.id === selectedCellId
                  ? 'rgba(255,110,180,0.3)'
                  : cell.folder ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${cell.id === selectedCellId ? '#ff6eb4' : 'transparent'}`,
                color: cell.folder ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)',
              }}
            >
              {cell.col + 1},{cell.row + 1}
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
