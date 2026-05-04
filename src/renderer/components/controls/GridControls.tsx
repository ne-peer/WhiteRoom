import React from 'react'
import { useAppStore } from '../../stores/appStore'
import { Section, Row, Stepper, Button, Toggle, NumberInput, Select } from './UIKit'
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
    restartSlideshowsRandomly,
  } = useAppStore()

  const selectedCell = cells.find(c => c.id === selectedCellId)

  const handleOpenFolder = async () => {
    if (!selectedCellId) return
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    const result = await api.openFolder()
    if (result.canceled || !result.folderPath || !result.images) return
    setCellFolder(selectedCellId, {
      id: `folder-${Date.now()}`,
      path: result.folderPath,
      images: result.images,
    })
  }

  const transitionOptions = [
    { value: 'none', label: 'なし' },
    { value: 'fade', label: 'フェード' },
    { value: 'slide-left', label: '左へスライド' },
    { value: 'slide-right', label: '右へスライド' },
    { value: 'slide-up', label: '上へスライド' },
    { value: 'slide-down', label: '下へスライド' },
    { value: 'zoom-in', label: 'ズームイン' },
    { value: 'zoom-out', label: 'ズームアウト' },
  ]

  return (
    <div>
      <Section title="グリッドサイズ">
        <Row label="列 (Col)">
          <Stepper value={grid.cols} min={1} max={15} onDecrement={removeColumn} onIncrement={addColumn} label="列" />
        </Row>
        <Row label="行 (Row)">
          <Stepper value={grid.rows} min={1} max={15} onDecrement={removeRow} onIncrement={addRow} label="行" />
        </Row>
      </Section>

      <Section title="スライドショー一括操作">
        <Button
          variant="secondary"
          onClick={restartSlideshowsRandomly}
          disabled={!cells.some(cell => cell.slideshow.enabled && cell.folder && cell.folder.images.length > 1)}
        >
          開始タイミングをランダムに再開
        </Button>
      </Section>

      <Section title="選択セル">
        {!selectedCellId ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '12px 0' }}>
            キャンバス上のセルをクリックして選択
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
              セル [{selectedCell ? selectedCell.col + 1 : '-'}, {selectedCell ? selectedCell.row + 1 : '-'}]
              {selectedCell?.folder ? ` / ${selectedCell.folder.images.length}枚` : ' / フォルダ未設定'}
            </div>

            <Row label="画像フィット">
              <Select
                value={selectedCell?.imageFit ?? 'cover'}
                options={[
                  { value: 'fitHeight', label: '高さに合わせる' },
                  { value: 'fitWidth', label: '横幅に合わせる' },
                  { value: 'cover', label: '大きい方に合わせる' },
                ]}
                onChange={v => setCellImageFit(selectedCellId, v as NonNullable<typeof selectedCell>['imageFit'])}
              />
            </Row>

            <Button variant="primary" onClick={handleOpenFolder}>
              フォルダを選択
            </Button>

            {selectedCell?.folder && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginBottom: 8, wordBreak: 'break-all' }}>
                  {selectedCell.folder.path}
                </div>
                <Button variant="secondary" onClick={() => setAllCellsFolder(selectedCell.folder!)}>
                  すべてのカラムにフォルダを反映
                </Button>

                <Section title="スライドショー">
                  <Row label="有効">
                    <Toggle
                      value={selectedCell.slideshow.enabled}
                      onChange={v => setCellSlideshow(selectedCellId, { enabled: v })}
                    />
                  </Row>
                  {selectedCell.slideshow.enabled && (
                    <>
                      <Row label="間隔">
                        <NumberInput
                          value={selectedCell.slideshow.intervalMs / 1000}
                          min={1}
                          max={3600}
                          step={1}
                          unit="秒"
                          onChange={v => setCellSlideshow(selectedCellId, { intervalMs: v * 1000 })}
                        />
                      </Row>
                      <Row label="ランダム">
                        <Toggle
                          value={selectedCell.slideshow.randomOrder}
                          onChange={v => setCellSlideshow(selectedCellId, { randomOrder: v })}
                        />
                      </Row>
                      <Row label="遷移効果">
                        <Select
                          value={selectedCell.slideshow.transition}
                          options={transitionOptions}
                          onChange={v => setCellSlideshow(selectedCellId, { transition: v as Cell['slideshow']['transition'] })}
                        />
                      </Row>
                      <Row label="遷移時間">
                        <NumberInput
                          value={selectedCell.slideshow.transitionDurationMs / 1000}
                          min={0.1}
                          max={3}
                          step={0.05}
                          unit="秒"
                          onChange={v => setCellSlideshow(selectedCellId, { transitionDurationMs: v * 1000 })}
                        />
                      </Row>
                    </>
                  )}
                  <Button variant="secondary" onClick={() => setAllCellsSlideshow(selectedCell.slideshow)}>
                    スライドショー設定を全カラムへ反映
                  </Button>
                </Section>
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="セル一覧">
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
          {cells.length}セル / {grid.cols}列 x {grid.rows}行
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
