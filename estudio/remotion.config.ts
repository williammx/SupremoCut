/**
 * SupremoCut — Configuração de render
 *
 * Ajustado pra RTX 3070 Ti: encode por GPU quando possível,
 * concorrência alta (Ryzen 7 5700X, 16 threads) e qualidade alta.
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);

// Codec e qualidade
Config.setCodec("h264");
Config.setCrf(17); // 17 = visualmente sem perda; suba pra 21 se quiser arquivo menor
Config.setPixelFormat("yuv420p");

// Performance — 16 threads disponíveis, deixo folga pro sistema
Config.setConcurrency(12);
Config.setChromiumOpenGlRenderer("angle");

// Áudio
Config.setAudioCodec("aac");

// Onde os renders caem
Config.setOutputLocation("../saida/video.mp4");

Config.setOverwriteOutput(true);
