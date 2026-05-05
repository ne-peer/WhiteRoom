import React from 'react'
import { useAppStore } from '../../stores/appStore'
import { Section, Row, Toggle, Slider, ColorPicker, NumberInput, Button } from '../controls/UIKit'
import type { Cell } from '../../../shared/types'

type Props = { selectedCell: Cell | undefined | null }

export const EffectsPanel: React.FC<Props> = ({ selectedCell }) => {
  const {
    setCellEffect,
    setAllCellsEffect,
    selectedCellId,
    cells,
    applyVignetteAndBlurToAll,
    restartEffectsRandomly,
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

  const { effects } = selectedCell
  const set = <K extends keyof typeof effects>(key: K, val: Partial<typeof effects[K]>) =>
    setCellEffect(selectedCellId, key, val)

  const applyAssetEffectToAll = () => {
    setAllCellsEffect('dynamicAsset', structuredClone(effects.dynamicAsset))
  }

  const handleOpenAsset = async () => {
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    const result = await api.openAsset()
    if (!result.canceled && result.filePath) {
      set('dynamicAsset', { assetPath: result.filePath })
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
            <Row label="全エフェクトに適用">
              <Toggle value={effects.blur.applyToAll} onChange={v => set('blur', { applyToAll: v })} />
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

      <Section title="一斉反映">
        <Button variant="primary" onClick={applyVignetteAndBlurToAll}>
          ビネット・ブラー設定を全カラムへ反映
        </Button>
        <div style={{ marginTop: 8 }}>
          <Button
            variant="secondary"
            onClick={restartEffectsRandomly}
            disabled={!cells.some(c => c.effects.vignette.dynamic || c.effects.blur.gradualEnabled)}
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
            {effects.dynamicAsset.assetPath && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8, wordBreak: 'break-all' }}>
                {effects.dynamicAsset.assetPath.split(/[\\/]/).pop()}
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
            <Row label="最大数">
              <NumberInput
                value={effects.dynamicAsset.maxParticles}
                min={1}
                max={100}
                step={1}
                onChange={v => set('dynamicAsset', { maxParticles: v })}
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
