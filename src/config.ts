import Envalid from 'envalid';

export default Envalid.cleanEnv(
  process.env,
  {
    PORT: Envalid.port({ default: 8000 }),
    LOGGER_LEVEL: Envalid.str({ default: 'debug' }),
    GIPHY_URL: Envalid.url(),
    GIPHY_TOKEN: Envalid.str(),
    GIPHY_LIMIT: Envalid.num({ default: 25 }),
    GIPHY_LANGUAGE: Envalid.str({ default: 'en' }),
  },
  { strict: true }
);
