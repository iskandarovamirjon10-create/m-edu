const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname);

module.exports = {
  apps: [
    {
      name: 'medu-api',
      script: 'node',
      args: 'dist/main.js',
      cwd: './apps/api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      cron_restart: '0 3 * * *', // Restart every day at 3:00 AM to prevent ffmpeg/Node memory leaks
      env: {
        NODE_ENV: 'production',
        FACE_ENGINE_PROVIDER: 'real-local',
        FACE_DETECTOR_MODEL_PATH: path.join(PROJECT_ROOT, 'packages', 'face-engine', 'models', 'face_detection_yunet_2023mar.onnx'),
        FACE_EMBEDDER_MODEL_PATH: path.join(PROJECT_ROOT, 'packages', 'face-engine', 'models', 'face_recognition_sface_2021dec.onnx'),
        FACE_LIVENESS_MODEL_PATH: path.join(PROJECT_ROOT, 'packages', 'face-engine', 'models', 'minifasnet_v2.onnx')
      }
    },
    {
      name: 'medu-web',
      script: 'npm',
      args: 'run preview',
      cwd: './apps/web',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: '4173'
      }
    }
  ]
};
