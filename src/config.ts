import Envalid from 'envalid';

export default Envalid.cleanEnv(
  process.env,
  {
    PORT: Envalid.port({ default: 8000 }),
    GIPHY_URL: Envalid.url(),
    GIPHY_TOKEN: Envalid.str(),
  },
  { strict: true }
);
