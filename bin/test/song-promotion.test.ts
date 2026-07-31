import test from "node:test";
import assert from "node:assert/strict";
import { PlayerCore } from "../domain/core/PlayerCore";
import { createSongModule, SongNoteColor } from "../domain/modules/song";
import { songBook, songNotes } from "../games/facility/events/songBook";

function createTestBus() {
  return {
    publish() {
      // Promotion tests do not rely on bus side effects.
    },
    subscribe() {
      return () => {
        // No-op unsubscribe for tests.
      };
    },
  };
}

function createSongHarness() {
  const player = new PlayerCore(
    { id: 1, name: "Promotion Tester" },
    { bus: createTestBus() },
  );
  const song = createSongModule(songBook, songNotes);
  player.attach(song);
  return song;
}

function compose(song: ReturnType<typeof createSongModule>, color: SongNoteColor) {
  const noteDef = songNotes[color];
  return song.composeNote({
    color,
    family: noteDef.family,
    icon: noteDef.icon,
    label: noteDef.label,
    power: 1,
    skillName: "test",
  });
}

function playMelody(song: ReturnType<typeof createSongModule>, notes: SongNoteColor[]) {
  let result: ReturnType<typeof song.composeNote> | undefined;
  for (const note of notes) {
    result = compose(song, note);
  }
  assert.ok(result?.activatedSong, "Expected melody to activate");
  return result.activatedSong;
}

function bufferSong(song: ReturnType<typeof createSongModule>, notes: SongNoteColor[]) {
  let result: ReturnType<typeof song.composeNote> | undefined;
  for (const note of notes) {
    result = compose(song, note);
  }
  assert.ok(result?.bufferedSong, "Expected song to be buffered");
  return result.bufferedSong;
}

function playBufferedSong(song: ReturnType<typeof createSongModule>, notes: SongNoteColor[]) {
  bufferSong(song, notes);
  const active = song.performStoredSong(0);
  assert.ok(active, "Expected buffered song to activate");
  return active;
}

function getActiveById(song: ReturnType<typeof createSongModule>, id: string) {
  const active = song.listActiveSongs().find((entry) => entry.id === id);
  assert.ok(active, `Expected active entry ${id}`);
  return active;
}

test("Melody promotion S + S = L", () => {
  const song = createSongHarness();

  playMelody(song, ["white", "white"]);
  playMelody(song, ["white", "white"]);

  const active = getActiveById(song, "mirror-etude");
  assert.equal(active.variant, "L");
  assert.equal(active.remainingShifts, 3);
});

test("Melody promotion L + L = XL", () => {
  const song = createSongHarness();

  playMelody(song, ["purple", "purple"]);
  playMelody(song, ["purple", "purple"]);

  const active = getActiveById(song, "mirror-etude");
  assert.equal(active.variant, "XL");
  assert.equal(active.remainingShifts, 3);
});

test("Melody downgrade L + S = S", () => {
  const song = createSongHarness();

  playMelody(song, ["purple", "purple"]);
  playMelody(song, ["white", "white"]);

  const active = getActiveById(song, "mirror-etude");
  assert.equal(active.variant, "S");
  assert.equal(active.remainingShifts, 2);
});

test("Song promotion S + S = L", () => {
  const song = createSongHarness();

  playBufferedSong(song, ["red", "white", "lightBlue"]);
  playBufferedSong(song, ["red", "white", "lightBlue"]);

  const active = getActiveById(song, "rallying-chorus");
  assert.equal(active.variant, "L");
  assert.equal(active.remainingShifts, 3);
});

test("Song promotion L + L = XL", () => {
  const song = createSongHarness();

  playBufferedSong(song, ["orange", "purple", "lightBlue"]);
  playBufferedSong(song, ["orange", "purple", "lightBlue"]);

  const active = getActiveById(song, "rallying-chorus");
  assert.equal(active.variant, "XL");
  assert.equal(active.remainingShifts, 3);
});

test("Song downgrade L + S = S", () => {
  const song = createSongHarness();

  playBufferedSong(song, ["orange", "purple", "lightBlue"]);
  playBufferedSong(song, ["red", "white", "lightBlue"]);

  const active = getActiveById(song, "rallying-chorus");
  assert.equal(active.variant, "S");
  assert.equal(active.remainingShifts, 2);
});
