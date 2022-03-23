import axios from 'axios';
import { assert } from 'console';
import EventSource from 'eventsource';

const BASE_URL = process.env.APP_URL || 'http://localhost:8000/api/v1';
const isDebug = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

const sleep = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const image1 = 'https://gifs.com/image1';
const image2 = 'https://gifs.com/image2';

(async function runTest() {
  console.log(`Running E2E test against ${BASE_URL}...`);
  console.log('A successful test will take approx 1 minute to finish');

  await sleep(3);

  try {
    const player1 = axios.create({
      baseURL: BASE_URL,
    });
    const player2 = axios.create({
      baseURL: BASE_URL,
    });

    const collectedEvents: { event: string; data: any }[] = [];
    const {
      data: { code },
    } = await player1.post('/games', {
      players: 2,
      rounds: 1,
    });

    const events = new EventSource(`${BASE_URL}/games/${code}/events`);
    events.addEventListener('message', (e: any) => {
      const event = JSON.parse(e.data);

      if (event.data?.error || (event.data && Object.keys(event.data).length === 0)) {
        console.error(event);
        process.exit(1);
      } else if (isDebug) {
        console.debug(JSON.stringify(event, null, 2));
      } else {
        console.log(event.event);
      }
      collectedEvents.push(event);
    });

    const { data: p1 } = await player1.post(`/games/${code}/join`, { name: 'P1' });
    await player1.post(`/games/${code}/ready`, { player: p1.id });
    const { data: p2 } = await player2.post(`/games/${code}/join`, { name: 'P2' });
    await player2.post(`/games/${code}/ready`, { player: p2.id });

    await sleep(1);

    await player2.post(`/games/${code}/rounds/1/images`, { player: p2.id, url: image2 });
    const { data: game } = await player1.post(`/games/${code}/rounds/1/images`, { player: p1.id, url: image1 });

    const image1Id = game.rounds[0].images.find((image: any) => image.url === image1).id;
    const image2Id = game.rounds[0].images.find((image: any) => image.url === image2).id;

    // Await presentation
    await sleep(21);

    await player1.post(`games/${code}/rounds/1/vote`, { player: p1.id, image: image2Id });
    await player2.post(`games/${code}/rounds/1/vote`, { player: p2.id, image: image1Id });

    // Await round winner presentation
    await sleep(11);

    const finalEvent = collectedEvents[collectedEvents.length - 1];

    assert(finalEvent.data.status === 'FINISHED');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
