import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { PsychedelicShader } from '../shaders/PsychedelicShader.ts';

export class PostProcessManager {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private shaderPass: ShaderPass;

  private currentIntensity = 0.0;
  private targetIntensity = 0.0;
  private lerpSpeed = 2.5;
  private distortionEnabled = true;

  private sceneryTexture: THREE.Texture | null = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ) {
    this.composer = new EffectComposer(renderer);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.shaderPass = new ShaderPass(PsychedelicShader);
    this.shaderPass.renderToScreen = true;
    this.composer.addPass(this.shaderPass);

    this.shaderPass.uniforms['uIntensity'].value = 0.0;
    this.shaderPass.uniforms['uAberration'].value = 1.0;
    this.shaderPass.uniforms['uTime'].value = 0.0;
    this.shaderPass.uniforms['uSceneryBlend'].value = 0.0;

    const loader = new THREE.TextureLoader();
    loader.load(
      '/textures/scenery.png',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        this.sceneryTexture = tex;
        this.shaderPass.uniforms['tScenery'].value = tex;
      },
      undefined,
      (err) => {
        console.warn('Scenery texture failed to load in PostProcessManager:', err);
      }
    );
  }

  public resize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  public setIntensity(target: number): void {
    this.targetIntensity = Math.min(Math.max(target, 0.0), 1.0);
  }

  public addIntensity(amount: number): void {
    this.setIntensity(this.targetIntensity + amount);
  }

  public getIntensity(): number {
    return this.currentIntensity;
  }

  public getTargetIntensity(): number {
    return this.targetIntensity;
  }

  public setDistortionEnabled(enabled: boolean): void {
    this.distortionEnabled = enabled;
    if (!enabled) {
      this.currentIntensity = 0.0;
      this.shaderPass.uniforms['uIntensity'].value = 0.0;
      this.shaderPass.uniforms['uAberration'].value = 0.0;
      this.shaderPass.uniforms['uSceneryBlend'].value = 0.0;
    }
  }

  public isDistortionEnabled(): boolean {
    return this.distortionEnabled;
  }

  public getSceneryTexture(): THREE.Texture | null {
    return this.sceneryTexture;
  }

  public update(delta: number): void {
    // 1. Increment time uniform
    this.shaderPass.uniforms['uTime'].value += delta;

    if (!this.distortionEnabled) {
      this.currentIntensity = 0.0;
      this.shaderPass.uniforms['uIntensity'].value = 0.0;
      this.shaderPass.uniforms['uAberration'].value = 0.0;
      this.shaderPass.uniforms['uSceneryBlend'].value = 0.0;
      return;
    }

    // 2. Smoothly interpolate current intensity toward target
    const alpha = 1 - Math.exp(-this.lerpSpeed * delta);
    this.currentIntensity += (this.targetIntensity - this.currentIntensity) * alpha;

    this.shaderPass.uniforms['uIntensity'].value = this.currentIntensity;
    this.shaderPass.uniforms['uAberration'].value = this.currentIntensity;

    // 3. Scenery blend disabled - hand-drawn scenery is not overlayed during trip
    if (this.shaderPass.uniforms['uSceneryBlend']) {
      this.shaderPass.uniforms['uSceneryBlend'].value = 0.0;
    }
  }

  public render(): void {
    this.composer.render();
  }
}
