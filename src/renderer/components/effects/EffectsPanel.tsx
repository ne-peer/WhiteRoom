import React from 'react'
import { useAppStore, DEFAULT_EFFECTS } from '../../stores/appStore'
import { Section, Row, Toggle, Slider, ColorPicker, NumberInput, Button, Select } from '../controls/UIKit'
import type { Cell } from '../../../shared/types'

const FONT_OPTIONS = [
  { value: 'Meiryo', label: 'メイリオ (Meiryo)' },
  { value: 'BIZ UDPGothic', label: 'BIZ UDPゴシック' },
  { value: 'Yu Gothic', label: '游ゴシック (Yu Gothic)' },
  { value: 'MS PGothic', label: 'ＭＳ Ｐゴシック' },
]

type Props = { selectedCell: Cell | undefined | null }

export const EffectsPanel: React.FC<Props> = ({ selectedCell }) => {
  const {
    setCellEffect,
    setAllCellsEffect,
    selectedCellId,
    cells,
    applyEffectsToAll,
    restartEffectsWithRandomTiming,
  } = useAppStore()

  if (!selectedCellId || !selectedCell) {
    return (
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '24px 0' }}>
        キャンバス上のセルをクリックして
        <br />
        エフェクトを編集
      </div>
    )
  }

  const rawEffects = selectedCell.effects
  const effects = {
    ...rawEffects,
    textEffect: rawEffects.textEffect ?? DEFAULT_EFFECTS.textEffect,
  }
  const set = <K extends keyof typeof effects>(key: K, val: Partial<typeof effects[K]>) =>
    setCellEffect(selectedCellId, key, val)

  const applyAssetEffectToAll = () => {
    setAllCellsEffect('dynamicAsset', structuredClone(effects.dynamicAsset))
  }

  const handleOpenAsset = async () => {
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    const result = await api.openAsset()
    if (!result.canceled && result.filePath) {
      set('dynamicAsset', { assetPath: result.filePath, assetPaths: [result.filePath], assetFolderPath: null })
    }
  }

  const handleOpenAssetFolder = async () => {
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    const result = await api.openAssetFolder()
    if (!result.canceled && result.folderPath && result.images && result.images.length > 0) {
      set('dynamicAsset', { assetPath: result.images[0], assetPaths: result.images, assetFolderPath: result.folderPath })
    }
  }

  return (
    <div>
      <Section title="色調オーバーレイ">
        <Row label="有効">
          <Toggle value={effects.colorOverlay.enabled} onChange={v => set('colorOverlay', { enabled: v })} />
        </Row>
        {effects.colorOverlay.enabled && (
          <>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>色</div>
            <ColorPicker
              r={effects.colorOverlay.color.r}
              g={effects.colorOverlay.color.g}
              b={effects.colorOverlay.color.b}
              onChange={(r, g, b) => set('colorOverlay', { color: { r, g, b } })}
              showAlpha
              alpha={effects.colorOverlay.alpha}
              onAlphaChange={a => set('colorOverlay', { alpha: a })}
            />
          </>
        )}
      </Section>

      <Section title="ビネットエフェクト">
        <Row label="有効">
          <Toggle value={effects.vignette.enabled} onChange={v => set('vignette', { enabled: v })} />
        </Row>
        {effects.vignette.enabled && (
          <>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>色</div>
            <ColorPicker
              r={effects.vignette.color.r}
              g={effects.vignette.color.g}
              b={effects.vignette.color.b}
              onChange={(r, g, b) => set('vignette', { color: { r, g, b } })}
              showAlpha
              alpha={effects.vignette.alpha}
              onAlphaChange={a => set('vignette', { alpha: a })}
            />
            <Row label="動的ビネット">
              <Toggle value={effects.vignette.dynamic} onChange={v => set('vignette', { dynamic: v })} />
            </Row>
            {effects.vignette.dynamic && (
              <>
                <Row label="開始透明度">
                  <Slider
                    value={Math.round(effects.vignette.dynamicFrom * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('vignette', { dynamicFrom: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label="終了透明度">
                  <Slider
                    value={Math.round(effects.vignette.dynamicTo * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('vignette', { dynamicTo: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label="変化時間">
                  <NumberInput
                    value={effects.vignette.dynamicDurationMs / 1000}
                    min={0.1}
                    max={10}
                    step={0.1}
                    unit="秒"
                    onChange={v => set('vignette', { dynamicDurationMs: v * 1000 })}
                  />
                </Row>
              </>
            )}
          </>
        )}
      </Section>

      <Section title="ブラーエフェクト">
        <Row label="有効">
          <Toggle value={effects.blur.enabled} onChange={v => set('blur', { enabled: v })} />
        </Row>
        {effects.blur.enabled && (
          <>
            <Row label="強度">
              <Slider
                value={effects.blur.strength}
                min={0}
                max={100}
                onChange={v => set('blur', { strength: v })}
              />
            </Row>
            <Row label="放射線状ブラー">
              <Toggle value={effects.blur.radialEnabled} onChange={v => set('blur', { radialEnabled: v })} />
            </Row>
            {effects.blur.radialEnabled && (
              <>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginBottom: 8 }}>
                  中心から周辺へ向かって、段階的にブラーが強くなります。
                </div>
                <Row label="強度係数">
                  <Slider
                    value={Math.round(effects.blur.radialIntensity * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('blur', { radialIntensity: v / 100 })}
                    unit="%"
                  />
                </Row>
              </>
            )}
            <Row label="徐々に増加">
              <Toggle value={effects.blur.gradualEnabled} onChange={v => set('blur', { gradualEnabled: v })} />
            </Row>
            {effects.blur.gradualEnabled && (
              <>
                <Row label="開始強度">
                  <Slider
                    value={effects.blur.gradualStartStrength}
                    min={0}
                    max={100}
                    onChange={v => set('blur', { gradualStartStrength: v })}
                  />
                </Row>
                <Row label="終了強度">
                  <Slider
                    value={effects.blur.gradualEndStrength}
                    min={0}
                    max={100}
                    onChange={v => set('blur', { gradualEndStrength: v })}
                  />
                </Row>
                <Row label="所要時間">
                  <NumberInput
                    value={effects.blur.gradualDurationSec}
                    min={1}
                    max={3600}
                    step={1}
                    unit="秒"
                    onChange={v => set('blur', { gradualDurationSec: v })}
                  />
                </Row>
              </>
            )}
          </>
        )}
      </Section>

      <Section title="エコーエフェクト">
        <Row label="有効">
          <Toggle value={effects.echo.enabled} onChange={v => set('echo', { enabled: v })} />
        </Row>
        {effects.echo.enabled && (
          <>
            <Row label="所要時間">
              <NumberInput
                value={effects.echo.durationSec}
                min={0.1}
                max={3600}
                step={0.1}
                unit="秒"
                onChange={v => set('echo', { durationSec: v })}
              />
            </Row>
            <Row label="開始不透明度">
              <Slider
                value={Math.round(effects.echo.startAlpha * 100)}
                min={0}
                max={100}
                onChange={v => set('echo', { startAlpha: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label="終了拡大率">
              <Slider
                value={Math.round(effects.echo.endScale * 100)}
                min={100}
                max={200}
                onChange={v => set('echo', { endScale: v / 100 })}
                unit="%"
              />
            </Row>
          </>
        )}
      </Section>

      <Section title="テキストエフェクト">
        <Row label="有効">
          <Toggle value={effects.textEffect.enabled} onChange={v => set('textEffect', { enabled: v })} />
        </Row>
        {effects.textEffect.enabled && (
          <>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>テキスト（最大5件、いずれかをランダム表示）</div>
            {effects.textEffect.texts.map((txt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', minWidth: 14 }}>{i + 1}</span>
                <input
                  type="text"
                  value={txt}
                  placeholder={`テキスト ${i + 1}`}
                  onChange={e => {
                    const next = [...effects.textEffect.texts]
                    next[i] = e.target.value
                    set('textEffect', { texts: next })
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 12,
                    padding: '3px 6px',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
            <Row label="フォント">
              <Select
                value={effects.textEffect.font}
                options={FONT_OPTIONS}
                onChange={v => set('textEffect', { font: v })}
              />
            </Row>
            <Row label="方向">
              <Select
                value={effects.textEffect.direction}
                options={[
                  { value: 'horizontal', label: '横書き' },
                  { value: 'vertical', label: '縦書き' },
                ]}
                onChange={v => set('textEffect', { direction: v as 'horizontal' | 'vertical' })}
              />
            </Row>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, marginTop: 6 }}>文字色</div>
            <ColorPicker
              r={effects.textEffect.color.r}
              g={effects.textEffect.color.g}
              b={effects.textEffect.color.b}
              onChange={(r, g, b) => set('textEffect', { color: { r, g, b } })}
            />
            <Row label="フォントサイズ">
              <Slider
                value={effects.textEffect.fontSize}
                min={8}
                max={200}
                step={1}
                onChange={v => set('textEffect', { fontSize: v })}
                unit="px"
              />
            </Row>
            <Row label="描画速度">
              <NumberInput
                value={effects.textEffect.charIntervalMs}
                min={10}
                max={2000}
                step={10}
                unit="ms/文字"
                onChange={v => set('textEffect', { charIntervalMs: v })}
              />
            </Row>
            <Row label="表示時間">
              <NumberInput
                value={effects.textEffect.displayDurationMs}
                min={100}
                max={30000}
                step={100}
                unit="ms"
                onChange={v => set('textEffect', { displayDurationMs: v })}
              />
            </Row>
            <Row label="表示間隔">
              <NumberInput
                value={effects.textEffect.intervalMs}
                min={0}
                max={30000}
                step={100}
                unit="ms"
                onChange={v => set('textEffect', { intervalMs: v })}
              />
            </Row>
          </>
        )}
      </Section>

      <Section title="一斉反映">
        <Button variant="primary" onClick={applyEffectsToAll}>
          エフェクトを全カラムへ反映
        </Button>
        <div style={{ marginTop: 8 }}>
          <Button
            variant="secondary"
            onClick={restartEffectsWithRandomTiming}
            disabled={!cells.some(c => c.effects.vignette.dynamic || c.effects.blur.gradualEnabled || c.effects.echo.enabled)}
          >
            開始タイミングをランダムに再開
          </Button>
        </div>
      </Section>

      <Section title="アセットエフェクト">
        <Row label="有効">
          <Toggle value={effects.dynamicAsset.enabled} onChange={v => set('dynamicAsset', { enabled: v })} />
        </Row>
        {effects.dynamicAsset.enabled && (
          <>
            <div style={{ marginBottom: 8 }}>
              <Button variant="secondary" onClick={handleOpenAsset}>
                アセット画像を選択
              </Button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Button variant="secondary" onClick={handleOpenAssetFolder}>
                フォルダからランダムに描画
              </Button>
            </div>
            {effects.dynamicAsset.assetPath && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8, wordBreak: 'break-all' }}>
                {effects.dynamicAsset.assetFolderPath
                  ? `${effects.dynamicAsset.assetFolderPath} (${effects.dynamicAsset.assetPaths.length}枚)`
                  : effects.dynamicAsset.assetPath.split(/[\\/]/).pop()}
              </div>
            )}
            <Row label="生成間隔">
              <NumberInput
                value={effects.dynamicAsset.spawnIntervalMs / 1000}
                min={0.1}
                max={5}
                step={0.1}
                unit="秒"
                onChange={v => set('dynamicAsset', { spawnIntervalMs: v * 1000 })}
              />
            </Row>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', margin: '8px 0 10px' }}>
              上昇速度は毎回 2px / 4px / 6px のいずれかからランダムに選ばれます。
            </div>
            <Row label="発生高さ上限">
              <Slider
                value={Math.round(effects.dynamicAsset.spawnMaxHeightRatio * 100)}
                min={0}
                max={70}
                onChange={v => set('dynamicAsset', { spawnMaxHeightRatio: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label="最大数">
              <NumberInput
                value={effects.dynamicAsset.maxParticles}
                min={1}
                max={100}
                step={1}
                onChange={v => set('dynamicAsset', { maxParticles: v })}
              />
            </Row>
            <Row label="サイズ">
              <Slider
                value={Math.round(effects.dynamicAsset.sizeRatio * 100)}
                min={10}
                max={300}
                onChange={v => set('dynamicAsset', { sizeRatio: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label="透明度">
              <Slider
                value={Math.round(effects.dynamicAsset.baseAlpha * 100)}
                min={0}
                max={100}
                onChange={v => set('dynamicAsset', { baseAlpha: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label="アセット色">
              <Toggle
                value={effects.dynamicAsset.colorOverlayEnabled}
                onChange={v => set('dynamicAsset', { colorOverlayEnabled: v })}
              />
            </Row>
            {effects.dynamicAsset.colorOverlayEnabled && (
              <ColorPicker
                r={effects.dynamicAsset.colorOverlayColor.r}
                g={effects.dynamicAsset.colorOverlayColor.g}
                b={effects.dynamicAsset.colorOverlayColor.b}
                onChange={(r, g, b) => set('dynamicAsset', { colorOverlayColor: { r, g, b } })}
                showAlpha
                alpha={effects.dynamicAsset.colorOverlayAlpha}
                onAlphaChange={a => set('dynamicAsset', { colorOverlayAlpha: a })}
              />
            )}
            <div style={{ marginTop: 10 }}>
              <Button variant="primary" onClick={applyAssetEffectToAll}>
                アセットエフェクト設定を全カラムへ反映
              </Button>
            </div>
          </>
        )}
      </Section>
    </div>
  )
}
