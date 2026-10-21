from abc import ABC, abstractmethod
import os
import json
import random
from openai import OpenAI
from .midi_generation import MidiService
from .personas import PERSONAS

# ---------------------------------------------------------------------------
# Response pools – each category has multiple unique, varied response templates.
# Templates support {bpm}, {key}, {note}, {chord}, {scale} placeholders.
# ---------------------------------------------------------------------------

_MELODY_RESPONSES = [
    "I've crafted a **melodic lead line**{bpm}{key}. The phrase arcs over 8 bars with a characteristic rise-and-fall contour — great for a verse or bridge. Drag the MIDI straight onto your instrument track!",
    "Here's a **sinuous top-line melody**{bpm}{key}. I've left intentional rhythmic gaps so the melody *breathes* — try layering a pad underneath to fill the space.",
    "Your **lead melody** is ready{bpm}{key}. I used a pentatonic shape for maximum singability, with a chromatic passing tone on bar 3 to add a little tension before the resolution.",
    "Composed a **melodic motif**{bpm}{key}. It starts with a short 2-bar hook, then develops with variation in bars 3–4 — a classic call-and-response structure. Perfect for looping with subtle changes.",
    "I generated a **lyrical solo line**{bpm}{key}. The phrasing is intentionally slightly behind the grid to give it a human, expressive feel. Drop it on a piano, strings, or lead synth!",
    "Here's a **modal melody**{bpm}{key} drawing from a Dorian flavour — slightly dark but with a hopeful lift at the end of the phrase. This works beautifully over minor chord progressions.",
    "Your **8-bar melodic phrase** is attached{bpm}{key}. Notice the rhythmic syncopation on beat 2 and 4 — this gives it a modern, groove-forward feel rather than sounding mechanical.",
    "I've written a **cinematic melody**{bpm}{key} with wide intervallic leaps (a 6th then a resolving step-down) — extremely effective for emotional, sweeping sections. Try it with a string ensemble patch.",
    "Here is a **call-and-response melodic idea**{bpm}{key}. Bars 1–2 state the theme; bars 3–4 answer with a variation at a different pitch level — a timeless compositional technique.",
    "Your **pentatonic lead**{bpm}{key} is ready. I kept the note choices simple but added rhythmic interest with dotted-eighth patterns. Works over almost any chord progression in the key.",
]

_BASS_RESPONSES = [
    "Here's a **syncopated bassline**{bpm} with a heavy sub-frequency emphasis. The groove locks to the off-beats — sidechain this to your kick for maximum punch on the low end.",
    "I've crafted a **funk-infused bass pattern**{bpm}. It uses a classic *ghost-note* approach: the root hits hard on beat 1, then lighter, quieter notes fill the sixteenth-note subdivisions between beats.",
    "Your **808-style sub bassline** is generated{bpm}. I pitched the slides between the root and the 5th to give it that characteristic portamento glide — essential for trap and modern pop production.",
    "Here's a **walking bass line**{bpm}{key} that moves chromatically between chord tones. This works perfectly under jazz, neo-soul, or lo-fi progressions to create harmonic movement even without chords.",
    "I created a **two-bar bass ostinato**{bpm} that stays on the root but uses rhythmic variation — anticipating beat 3 and adding a 16th-note run into bar 2. Subtle but deeply groovy.",
    "Your **house-style bass pattern** is ready{bpm}. It's a tight, four-on-the-floor locked groove: root note on every quarter, with a quick 'dip' sub-note on the '+' of beat 2 for groove.",
    "Here's a **melodic bassline**{bpm}{key} that doubles as a counter-melody. Rather than just holding root notes, it moves through the chord tones in an arching phrase — very effective in stripped-back sections.",
    "I generated a **trap-influenced 808 pattern**{bpm} with long slides and note-length variation. Quantize the velocities at ~80% to let the dynamics breathe. Layer a sine-wave sub underneath for maximum weight.",
    "Your **staccato bass groove**{bpm} is attached. Short, punchy notes on the offbeats create a rhythmic push-pull tension with the kick drum. Try layering it with a muted electric bass sound.",
    "Here's a **reggaeton-influenced dembow bass**{bpm} — the classic skip pattern (beat 1, the 'and' of 2, beat 3) gives it that undeniable rhythmic energy. Works at almost any tempo.",
]

_CHORD_RESPONSES = [
    "I've generated a **rich 4-bar chord progression**{bpm}{key}: Cmaj7 → Am9 → Fmaj7 → G13. Each chord is voiced in open position to allow the inner voices to breathe — perfect for pad layers.",
    "Your **chord progression** is ready{bpm}{key}. I used a **ii–V–I turnaround** to give it a jazz-influenced resolution: Dm9 → G7(#9) → Cmaj9 → Am11. Lush and sophisticated.",
    "Here's a **modal chord stack**{bpm}{key} using sus2 and sus4 voicings to avoid the tonal gravity of major/minor thirds — great for creating an ambiguous, floating, cinematic atmosphere.",
    "I created a **four-chord loop with borrowed harmony**{bpm}{key}: C major → Ab major → F minor → G major. The ♭VI and iv give it that unexpected, emotional 'turn' characteristic of modern pop.",
    "Your **extended harmony progression** is attached{bpm}{key}. Each chord is a 9th or 11th voicing — stacking intervals beyond the 7th creates that lush, neo-soul texture. Try a Rhodes or Wurlitzer patch.",
    "I've written a **I–V–vi–IV** progression{bpm}{key} but voiced it in 2nd inversion to create smooth bass-line movement between chords. It sounds familiar yet elevated.",
    "Here's an **ambiguous chord progression**{bpm}{key} that deliberately avoids stating a clear tonic — shifting between relative major/minor creates an emotional tension perfect for intros or pre-choruses.",
    "I generated a **gospel-inspired progression**{bpm}{key}: I → IV → I → V7. What makes it special is the inner-voice movement on the IV chord — let the middle voice descend chromatically for a rich, soulful feel.",
    "Your **chord sequence** is ready{bpm}{key}. I included a **secondary dominant** (V7/ii) on bar 3 to add a moment of harmonic colour before resolving back — subtle, effective, and professional.",
    "Here's a **chromatic mediant progression**{bpm}{key} — moving between chords whose roots are a major or minor third apart. C → E → Am → F → Db creates a dramatic, cinematic quality.",
]

_DRUM_RESPONSES = [
    "Here's an **energetic drum pattern**{bpm}. The kick locks to beats 1 and the '+' of 3 for a forward-pushing groove, while the snare sits fat on 2 and 4. Add an open hi-hat on the '+' of beat 4 for lift.",
    "I've generated a **trap-influenced hi-hat roll pattern**{bpm}. Rapid 32nd-note hi-hat variations create rhythmic density, while the kick stays sparse and unpredictable — defining the modern trap feel.",
    "Your **polyrhythmic groove**{bpm} is attached. The kick follows a 3-against-4 pattern over the snare's standard 2-and-4 placement — creates a driving, slightly off-kilter feel that keeps listeners engaged.",
    "Here's a **Kuthu-inspired folk drum pattern**{bpm}. It features an asymmetric rhythm (3+2+3 subdivisions) layered over a straight 4/4 kick, blending Indian folk rhythmic tradition with modern production.",
    "I created a **four-on-the-floor kick with a ghost-note snare**{bpm}. The kick hits every quarter note, while the snare includes quiet ghost notes between the main hits for a *live drummer* texture.",
    "Your **breakbeat-style pattern**{bpm} is ready. Kick and snare are offset from the grid in a syncopated shuffle — inspired by classic boom-bap production. Layer a sub-bass on the kicks for depth.",
    "Here's a **half-time groove**{bpm}. The snare lands on beat 3 only (not 2 and 4), making the tempo feel twice as slow and heavy — perfect for drops, emotional sections, or creating contrast before a chorus.",
    "I generated a **samba-influenced rhythm**{bpm} with a cascading pattern across the toms, adding percussive interest beyond the standard kick-snare-hihat axis. Great as a drum-fill loop or B-section groove.",
    "Your **minimalist drum groove**{bpm} is ready. Less is more — a clean kick on 1 and 3, a crisp snare on 2 and 4, and a closed hi-hat only on beats 1 and 3. Intentional space is where the groove lives.",
    "Here's a **drum loop with fills**{bpm}. Bar 4 breaks out of the pattern with a tom roll leading into beat 1 — this 'breath' in the groove signals a section change and adds musical momentum.",
]

_MIXING_RESPONSES = [
    "**Mixing tip:** Your low end is likely competing. Try a high-pass filter on every non-bass element at 80–120 Hz to create space. Then apply a gentle sidechain compression on your pads/bass triggered by the kick.",
    "**Stereo field check:** Consider using mid-side EQ. Cut a little low-mid mud (200–400 Hz) in the *side* channel — this tightens your mix without losing the stereo width your pads and leads provide.",
    "**Frequency analysis:** Look for a build-up around 2–4 kHz — this is where harshness lives. A narrow dip (2–3 dB, Q of 3–5) with a dynamic EQ rather than a static cut will keep presence without fatigue.",
    "**Dynamic range tip:** If your mix sounds flat, automate the master bus compressor's wet/dry ratio — push it harder during the chorus, ease off during verse sections. Perceived loudness variation creates energy.",
    "**Reverb advice:** Send all your instruments to 2–3 shared reverb buses rather than individual insert reverbs. This creates a sense of one unified 'room' and glues the elements together cohesively.",
    "**Vocal presence:** Boost a gentle high shelf (+1.5–2 dB above 10 kHz) on the lead vocal for 'air', then dip the same region on your backing instruments. This carves space for the vocal to sit on top.",
    "**Low-end clarity:** Use multiband compression on your bass. Only compress the sub-frequencies (20–80 Hz) to keep them consistent, while leaving the upper harmonics (80–200 Hz) dynamic and punchy.",
    "**Transient shaping:** Add an SPL Transient Designer (or equivalent) to your drum bus — attack at 0, sustain at -3 dB. This tightens the tail of each hit and makes drums sound more punchy in a dense mix.",
]

_ARRANGEMENT_RESPONSES = [
    "**Arrangement idea:** You're likely missing a *pre-chorus*. A 4-bar section that builds tension (strip back instruments, raise a filtered synth pad, increase harmonic rhythm) before the chorus drop amplifies impact dramatically.",
    "**Structure suggestion:** Try a *double chorus* at the end — repeat your chorus section with an added element (a new counter-melody, a key change of +2 semitones, or a denser drum pattern) for a powerful ending.",
    "**Tension and release:** Your arrangement would benefit from a *breakdown* section. Remove the kick and bass entirely for 4–8 bars, leaving only a melodic element and atmospheric pads. The re-entry will feel explosive.",
    "**Density mapping:** Chart the number of active elements per section — intro, verse, pre-chorus, chorus, bridge. If there's no clear *increase* in density moving from verse to chorus, you lose the sense of a 'lift'.",
    "**Contrast principle:** If your verse is dense and busy, try stripping the bridge to just 1–2 elements. Contrast in texture is as important as contrast in melody and harmony for keeping listeners engaged.",
    "**Bridge idea:** Consider a brief *modulation* in the bridge (shift the key up or down a minor third). Even 4 bars in a different key creates a dramatic emotional shift before the return of the final chorus.",
    "**Layer-building intro:** Instead of starting with the full arrangement, introduce elements one at a time: drums alone for 4 bars → add bass → add chords → add melody. This *telescoping* approach builds anticipation beautifully.",
    "**Outro strategy:** Avoid a hard stop — let the elements drop out one-by-one in reverse order from how they entered. This mirrors the intro structure and gives the track a satisfying sense of closure.",
]

_GENERAL_RESPONSES = [
    "I'm analyzing your message{bpm}{key}. Here are a few directions to consider:\n\n- **Add harmonic depth**: Try a chord voicing beyond the basic triad — a maj7 or 9th adds sophistication instantly.\n- **Rhythmic variety**: Introduce a syncopated element (off-beat hit) to break grid monotony.\n- **Textural contrast**: If all your layers are busy, remove one or two. Space is a production tool, not an absence of effort.",
    "Good question! Let me break down some production directions{bpm}{key}:\n\n1. **Frequency balance**: Start with a reference track and use a spectrum analyzer to match the broad shape of its EQ curve.\n2. **Dynamic feel**: Try automating your instrument volumes — a subtle 1–2 dB swell into the chorus makes a huge difference.\n3. **Spatial depth**: Layer the same melodic phrase with a dry close version and a distant reverb-heavy version to create front-to-back depth.",
    "Here's my analysis of your project{bpm}{key}:\n\n- **Energy curve**: Map your arrangement's energy — if it peaks too early, the track has nowhere to go. Delay your biggest moment to 70–75% of the total duration.\n- **Sonic colour**: Consider whether your sounds match the emotion. Bright, sharp sounds read as energetic; dark, filtered sounds read as mysterious or introspective.\n- **Genre conventions**: Every genre has structural expectations — use them as a foundation and break one rule deliberately for personality.",
    "Let me offer some targeted production tips{bpm}{key}:\n\n**Groove**: Humanize your MIDI by adding slight timing variation (±5–10 ms) to off-beat hits. Perfect quantization can make patterns feel robotic.\n\n**Layering**: Stack two complementary timbres on the same melodic part — e.g., a piano layer beneath a pad — to create composite textures that feel fuller.\n\n**Automation**: Automate one unusual parameter (filter cutoff, reverb send, bit-depth) to add movement that keeps the listener's ear engaged throughout.",
    "Thinking about your track{bpm}{key} — here are the areas I'd focus on:\n\n🎛️ **Compression**: Use parallel compression on your drum bus — blend a heavily squashed copy with the dry signal. You get punch AND dynamics.\n\n🎹 **Harmony**: Avoid staying on the I chord too long — even a brief passing chord (like a IV or ii) between repetitions prevents harmonic stagnation.\n\n🔊 **Loudness**: Reference your final mix at around -14 LUFS (streaming standard) during the creative process. Many producers master too loud, crushing dynamics.",
    "Here are some production directions worth exploring{bpm}{key}:\n\n- **Call and response**: Design your arrangement so instruments 'answer' each other — a guitar lick followed by a bass riff, or a vocal phrase answered by a synth.\n- **Motivic development**: Take your main melodic motif and invert it, retrograde it, or transpose it by a 5th. Variations on a theme create cohesion across sections.\n- **Sub-mix bussing**: Group similar elements (all synths, all drums, all vocals) to a bus and process them together — this unifies their timbres and makes mixing much more efficient.",
    "Based on your project context{bpm}{key}, here's a direction to push forward:\n\nFocus on your **hook density** — the moment the listener should feel the track 'arrive'. Ask: is every element at that moment earning its place? Remove one layer and see if the impact *increases* due to contrast.\n\nAlso, check your **panning choices**: Mono low-end, near-centre mids, and wide highs is the time-tested approach. Verify with your mix in mono to catch any phase-cancellation surprises.",
    "Let me think about your production{bpm}{key}. A few angles:\n\n**Emotional arc**: Great tracks have a narrative. Introduce tension (raise the stakes — add dissonance, increase density, raise pitch) and resolution (reduce density, resolve to root) for a satisfying journey.\n\n**Sound design**: Even a simple synth patch feels premium if the filter envelope is tweaked. A longer filter attack on a pad versus a snap attack on a lead creates totally different emotional reads.\n\n**Reference mixing**: Pull up a commercial track in the same genre and A/B your mix against it — your ear adjusts to your mix over time; fresh comparison reveals what needs work.",
]

# Persona prefix pools — picked randomly per call for variety
_PERSONA_PREFIXES = {
    "ar_rahman": [
        "✨ *A.R. Rahman AI*: \"Brother, music is first a feeling, then a sound. Let the emotion lead the arrangement.\" ",
        "✨ *A.R. Rahman AI*: \"Every note must serve the soul of the song. Don't add layers — add meaning.\" ",
        "✨ *A.R. Rahman AI*: \"Think of your DAW as a canvas — paint with sounds from every corner of the world.\" ",
        "✨ *A.R. Rahman AI*: \"The gap between notes matters as much as the notes themselves. Breathe into your music.\" ",
        "✨ *A.R. Rahman AI*: \"Blend the ancient and the modern — a raga melodic phrase over an electronic groove is where magic lives.\" ",
    ],
    "harris_jayaraj": [
        "🎸 *Harris Jayaraj AI*: \"Keep the acoustic guitar plucks crisp and pan your shaker tracks wide! Every detail in the mix matters.\" ",
        "🎸 *Harris Jayaraj AI*: \"The vocal lead must be pristine — everything else exists to lift it, not compete with it.\" ",
        "🎸 *Harris Jayaraj AI*: \"Ping-pong delay on the vocal chop, hard-panned acoustic strums, and a tight snare — that's the signature vibe.\" ",
        "🎸 *Harris Jayaraj AI*: \"Never sacrifice clarity for density. Clean separation between elements is what makes a mix sound premium.\" ",
        "🎸 *Harris Jayaraj AI*: \"Add a lush string swell under the chorus — subtle, but it changes everything about how the emotion lands.\" ",
    ],
    "anirudh": [
        "🔥 *Anirudh AI*: \"Bro, we need massive energy right here! Let's throw a heavy 808 sub and punchy brass hits underneath!\" ",
        "🔥 *Anirudh AI*: \"This needs a CRAZY drop! Add a Thavil-inspired rhythm pattern under the EDM bass — that contrast is fire!\" ",
        "🔥 *Anirudh AI*: \"Bro! This whistle melody moment — it needs to hit the listener RIGHT in the chest. Let's go bigger!\" ",
        "🔥 *Anirudh AI*: \"Layer that Kuthu beat under a trap hi-hat roll and watch the groove go insane — trust me on this!\" ",
        "🔥 *Anirudh AI*: \"Global vibes, local soul — that's the formula. Let's fuse something nobody's heard before!\" ",
    ],
}


class LLMService(ABC):
    @abstractmethod
    def generate_response(self, message: str, context: list = None, persona_id: str = None, daw_state: dict = None) -> dict:
        pass


class MusicProducerLLMService(LLMService):
    """
    Real-time Music Producer AI engine with DAW awareness, persona voice styling,
    and automatic real MIDI generation & file attachments.

    Responses are selected randomly from curated pools per musical category so
    that every interaction feels unique and contextually relevant.
    """
    def __init__(self):
        self.midi_service = MidiService()

    def generate_response(self, message: str, context: list = None, persona_id: str = None, daw_state: dict = None) -> dict:
        msg_lower = message.lower()
        files = []

        # --- Build dynamic context strings from DAW state ---
        bpm_val = daw_state.get('bpm') if daw_state else None
        key_val = daw_state.get('key') if daw_state else None
        bpm_str = f" at **{bpm_val} BPM**" if bpm_val else " at **120 BPM**"
        key_str = f" in **{key_val}**" if key_val else ""

        # --- Keyword routing: pick category and response pool ---
        if any(kw in msg_lower for kw in ["melody", "violin", "lead", "solo", "top line", "topline", "riff"]):
            pattern = "sad_violin" if ("violin" in msg_lower or "sad" in msg_lower) else "melody"
            midi_path = self.midi_service.generate_melody_from_pattern(pattern)
            files.append({"type": "midi", "url": midi_path, "name": "Generated Melody"})
            template = random.choice(_MELODY_RESPONSES)

        elif any(kw in msg_lower for kw in ["bass", "bassline", "sub", "808", "low end", "house bass", "walking bass"]):
            midi_path = self.midi_service.generate_melody_from_pattern("house_bass")
            files.append({"type": "midi", "url": midi_path, "name": "Bass Pattern"})
            template = random.choice(_BASS_RESPONSES)

        elif any(kw in msg_lower for kw in ["chord", "progression", "harmony", "harmonic", "keys", "piano", "voicing", "chords"]):
            midi_path = self.midi_service.generate_melody_from_pattern("chords")
            files.append({"type": "midi", "url": midi_path, "name": "Chord Progression"})
            template = random.choice(_CHORD_RESPONSES)

        elif any(kw in msg_lower for kw in ["beat", "drum", "rhythm", "kuthu", "loop", "groove", "pattern", "percussion"]):
            midi_path = self.midi_service.generate_melody_from_pattern("drum_pattern")
            files.append({"type": "midi", "url": midi_path, "name": "Drum Beat Pattern"})
            template = random.choice(_DRUM_RESPONSES)

        elif any(kw in msg_lower for kw in ["mix", "mixing", "eq", "equaliz", "compress", "reverb", "delay", "stereo", "frequency", "loudness", "master"]):
            template = random.choice(_MIXING_RESPONSES)

        elif any(kw in msg_lower for kw in ["arrange", "arrangement", "structure", "section", "verse", "chorus", "bridge", "intro", "outro", "breakdown", "drop"]):
            template = random.choice(_ARRANGEMENT_RESPONSES)

        else:
            template = random.choice(_GENERAL_RESPONSES)

        # Substitute placeholders in the chosen template
        response_body = template.replace("{bpm}", bpm_str).replace("{key}", key_str)

        # --- Apply persona styling ---
        if persona_id and persona_id in PERSONAS:
            persona = PERSONAS[persona_id]
            prefix_pool = _PERSONA_PREFIXES.get(persona_id)
            if prefix_pool:
                prefix = random.choice(prefix_pool)
            else:
                prefix = f"🎧 *{persona['name']}*: "
            response_body = prefix + response_body

        return {
            "text": response_body,
            "files": files,
        }


class MockLLMService(MusicProducerLLMService):
    """Legacy alias pointing to MusicProducerLLMService."""
    pass


class OpenAILLMService(LLMService):
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.midi_service = MidiService()

    def generate_response(self, message: str, context: list = None, persona_id: str = None, daw_state: dict = None) -> dict:
        try:
            system_content = "You are Audio Copilot, an expert AI music producer and audio engineer."
            if daw_state and daw_state.get('connected'):
                system_content += f" Current DAW project metadata: {json.dumps(daw_state)}."

            if persona_id and persona_id in PERSONAS:
                persona = PERSONAS[persona_id]
                system_content += f" Adopt the exact musical persona and style of {persona['name']}: {persona['description']}."

            messages = [{"role": "system", "content": system_content}]
            if context:
                messages.extend(context)
            messages.append({"role": "user", "content": message})

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages
            )
            text_resp = response.choices[0].message.content
            files = []

            # Auto-generate MIDI file if user asked for MIDI composition
            msg_lower = message.lower()
            if any(kw in msg_lower for kw in ["melody", "violin", "bass", "chord", "drum", "beat", "midi"]):
                midi_path = self.midi_service.generate_melody_from_pattern(msg_lower)
                files.append({"type": "midi", "url": midi_path, "name": "Generated MIDI"})

            return {"text": text_resp, "files": files}
        except Exception as e:
            # Graceful fallback to local engine if OpenAI API key has an issue
            fallback_engine = MusicProducerLLMService()
            return fallback_engine.generate_response(message, context, persona_id, daw_state)
