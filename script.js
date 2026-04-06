import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 🔑 Supabase
const supabase = createClient(
  "https://lgpydcsolgbqiuplvjsc.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncHlkY3NvbGdicWl1cGx2anNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDE0ODgsImV4cCI6MjA4OTUxNzQ4OH0.bmCbu6fjAixqCMwBbms2tAXHpzJOccz57_RrAKjovTQ"
);

// =========================
// 🔥 DATUM BEPERKING
// =========================

const datumInput = document.getElementById("datum");

if (datumInput) {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 1);

  datumInput.min = today.toISOString().split("T")[0];
  datumInput.max = maxDate.toISOString().split("T")[0];
}

// =========================
// BLOKKEN
// =========================

const isolatieBlokken = [
  {start:"13:30", end:"14:30"},
  {start:"14:30", end:"15:30"},
  {start:"15:30", end:"16:30"},
  {start:"16:30", end:"17:30"},
  {start:"17:30", end:"18:30"},
  {start:"18:30", end:"19:30"}
];

const elektrischBlokken = [
  {start:"13:30", end:"15:30"},
  {start:"15:30", end:"17:30"},
  {start:"17:30", end:"19:30"}
];

const elektrisch = ["Zonnepanelen","Batterij","Warmtepomp","Airco","Laadpaal"];

// =========================
// HELPERS
// =========================

function bepaalType(){
  const checks = document.querySelectorAll('input[name="interesse"]:checked');
  for(let c of checks){
    if(elektrisch.includes(c.value)) return "elektrisch";
  }
  return "isolatie";
}

function normalizeDate(d){
  return new Date(d).toISOString().split("T")[0];
}

function toMinutes(t){
  const [h,m] = t.split(":").map(Number);
  return h*60 + m;
}

function getEnd(start, duur){
  const end = toMinutes(start) + duur;
  const h = Math.floor(end/60).toString().padStart(2,"0");
  const m = (end%60).toString().padStart(2,"0");
  return `${h}:${m}`;
}

// =========================
// 🔥 ADRES AUTO (WERKT)
// =========================

async function haalAdresOp(postcode, huisnummer) {
  if (!postcode || !huisnummer) return;

  try {
    const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${postcode}+${huisnummer}`);
    const data = await res.json();

    const doc = data?.response?.docs?.[0];

    if (doc) {
      const straatInput = document.getElementById("straatnaam");
      if (straatInput) {
        straatInput.value = doc.straatnaam || "";
      }

      const plaatsInput = document.getElementById("plaats");
      if (plaatsInput) {
        plaatsInput.value = doc.woonplaatsnaam || "";
      }
    }

  } catch (err) {
    console.error("Adres fout:", err);
  }
}

// 👉 events (GEEN haalStraatOp meer!)
const postcodeInput = document.getElementById("postcode");
const huisnummerInput = document.getElementById("huisnummer");

if (postcodeInput && huisnummerInput) {
  postcodeInput.addEventListener("blur", () => {
    haalAdresOp(postcodeInput.value, huisnummerInput.value);
  });

  huisnummerInput.addEventListener("blur", () => {
    haalAdresOp(postcodeInput.value, huisnummerInput.value);
  });
}

// =========================
// 🔥 TIJDSLOTEN
// =========================

async function genereerTijdsloten(){

  const select = document.getElementById("tijdslot");
  const datumRaw = document.getElementById("datum")?.value;

  if (!select || !datumRaw) return;

  select.innerHTML = '<option value="">Kies een tijd</option>';

  const gekozenDatumObj = new Date(datumRaw);

  if(gekozenDatumObj.getDay() === 0){
    select.innerHTML = '<option value="">Zondag gesloten</option>';
    return;
  }

  const gekozenDatum = normalizeDate(datumRaw);

  const { data } = await supabase
    .from("afspraken")
    .select("datum, tijdslot, interesse, status");

  const bookedBlocks = (data || [])
    .filter(a => normalizeDate(a.datum) === gekozenDatum && a.status !== "geannuleerd")
    .map(a => {
      const start = a.tijdslot.slice(0,5);
      const duur = elektrisch.includes(a.interesse) ? 120 : 60;

      return {
        start,
        end: getEnd(start, duur)
      };
    });

  function overlaps(block){
    const s1 = toMinutes(block.start);
    const e1 = toMinutes(block.end);

    return bookedBlocks.some(b => {
      const s2 = toMinutes(b.start);
      const e2 = toMinutes(b.end);
      return s1 < e2 && e1 > s2;
    });
  }

  const type = bepaalType();
  const blocks = type === "elektrisch" ? elektrischBlokken : isolatieBlokken;

  blocks.forEach(block => {
    if(overlaps(block)) return;

    const option = document.createElement("option");
    option.value = block.start;
    option.textContent = `${block.start} - ${block.end}`;
    select.appendChild(option);
  });
}

document.getElementById("datum")?.addEventListener("change", genereerTijdsloten);
document.querySelectorAll('input[name="interesse"]').forEach(el=>{
  el.addEventListener("change", genereerTijdsloten);
});

genereerTijdsloten();

// =========================
// 🔥 SUBMIT
// =========================

document.getElementById("afspraakForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const interesses = document.querySelectorAll('input[name="interesse"]:checked');
  const partner = document.querySelector('input[name="partner"]:checked');

  const dataToInsert = {

    werver: document.getElementById("werver")?.value.trim() || "",

    datum: document.getElementById("datum")?.value,
    tijdslot: document.getElementById("tijdslot")?.value,

    voornaam: document.getElementById("voornaam")?.value.trim(),
    achternaam: document.getElementById("achternaam")?.value.trim(),

    telefoon: document.getElementById("telefoon")?.value.trim(),
    email: document.getElementById("email")?.value.trim(),

    postcode: document.getElementById("postcode")?.value.trim(),
    huisnummer: document.getElementById("huisnummer")?.value.trim(),
    straatnaam: document.getElementById("straatnaam")?.value.trim(),

    plaats: document.getElementById("plaats")?.value || "",

    zelfgedaan: document.getElementById("zelfgedaan")?.value.trim(),

    interesse: Array.from(interesses).map(i => i.value).join(","),

    advies_gesprek: document.getElementById("doel")?.value || "",
    notities: document.getElementById("notities")?.value || "",
    partner_aanwezig: partner?.value || "",

    status: "nieuw"
  };

  const { error } = await supabase
    .from("afspraken")
    .insert([dataToInsert]);

  if(error){
    console.error(error);
    alert("Fout bij opslaan");
  } else {
    alert("Afspraak opgeslagen ✅");
    document.getElementById("afspraakForm").reset();
    genereerTijdsloten();
  }
});