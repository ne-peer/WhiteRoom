import { Filter } from 'pixi.js'

/** Pixi デフォルトのフィルター用頂点シェーダー（defaultFilter.vert と同内容） */
const FLASH_RADIAL_FADE_VERT = `in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`

const FLASH_RADIAL_FADE_FRAG = `in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uInnerRadius;
uniform float uSurroundingTransparency;
uniform float uAspect;
uniform float uRadialCenterX;
uniform float uRadialCenterY;

void main(void)
{
    vec4 c = texture(uTexture, vTextureCoord);
    vec2 qc = vec2(uRadialCenterX * uAspect, uRadialCenterY);
    vec2 q = vec2(vTextureCoord.x * uAspect, vTextureCoord.y);
    float d0 = distance(qc, vec2(0.0, 0.0));
    float d1 = distance(qc, vec2(uAspect, 0.0));
    float d2 = distance(qc, vec2(0.0, 1.0));
    float d3 = distance(qc, vec2(uAspect, 1.0));
    float maxR = max(max(d0, d1), max(d2, d3));
    float dist = distance(q, qc) / max(maxR, 1e-5);
    dist = clamp(dist, 0.0, 1.0);
    float inner = clamp(uInnerRadius, 0.0, 0.999);
    float t = smoothstep(inner, 1.0, dist);
    float fadeAmt = clamp(uSurroundingTransparency, 0.0, 1.0);
    float alphaMult = clamp(1.0 - t * fadeAmt, 0.0, 1.0);
    finalColor = c * alphaMult;
}
`

export function createFlashRadialFadeFilter(): Filter {
  return Filter.from({
    gl: {
      vertex: FLASH_RADIAL_FADE_VERT,
      fragment: FLASH_RADIAL_FADE_FRAG,
      name: 'whiteroom-flash-radial-fade',
    },
    padding: 0,
    resources: {
      flashRadialFadeUniforms: {
        uInnerRadius: { value: 0, type: 'f32' },
        uSurroundingTransparency: { value: 0, type: 'f32' },
        uAspect: { value: 1, type: 'f32' },
        uRadialCenterX: { value: 0.5, type: 'f32' },
        uRadialCenterY: { value: 0.5, type: 'f32' },
      },
    },
  })
}

type FlashRadialUniforms = {
  uInnerRadius: number
  uSurroundingTransparency: number
  uAspect: number
  uRadialCenterX: number
  uRadialCenterY: number
}

export function setFlashRadialFadeUniforms(
  filter: Filter,
  uniforms: FlashRadialUniforms
) {
  const group = filter.resources.flashRadialFadeUniforms as { uniforms: FlashRadialUniforms }
  Object.assign(group.uniforms, uniforms)
}
