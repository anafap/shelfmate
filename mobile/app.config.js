module.exports = ({ config }) => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const googleServicesFile = process.env.SHELFMATE_GOOGLE_SERVICES_FILE;
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}) },
    plugins: [...config.plugins, './plugins/withLocalReleaseSigning'],
  };
};
