import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 🔑 Supabase
const supabase = createClient(
  "https://lgpydcsolgbqiuplvjsc.supabase.co",
  "YOUR_ANON_KEY"
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
// 🔥 ADRES AUTO
// =========================

async function haalAdresOp(postcode, huisnummer) {
  if (!postcode || !huisnummer) return;

  try {
    const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${postcode}+${huisnummer}`);
    const data = await res.json();

    const doc = data?.response?.docs?.[0];

    if (doc) {
      document.getElementById("straatnaam").value = doc.straatnaam || "";
      document.getElementById("plaats").value = doc.woonplaatsnaam || "";
    }

  } catch (err) {
    console.error("Adres fout:", err);
  }
}

const postcodeInput = document.getElementById("postcode");
const huisnummerInput = document.getElementById("huisnummer");

postcodeInput?.addEventListener("blur", () => {
  haalAdresOp(postcodeInput.value, huisnummerInput.value);
});

huisnummerInput?.addEventListener("blur", () => {
  haalAdresOp(postcodeInput.value, huisnummerInput.value);
});

// =========================
// 🔥 TIJDSLOTEN (FIXED)
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

  // 🔥 FIX: alleen blokkeren op gekwalificeerd + voicemail
  const bookedBlocks = (data || [])
    .filter(a =>
      normalizeDate(a.datum) === gekozenDatum &&
      ["gekwalificeerd", "voicemail"].includes(a.status?.toLowerCase())
    )
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

document.getElementById("af