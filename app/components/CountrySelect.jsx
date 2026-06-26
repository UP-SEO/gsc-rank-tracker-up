"use client";

const COUNTRY_NAMES = {
  ukr:"Україна", usa:"США", gbr:"Велика Британія", deu:"Німеччина",
  fra:"Франція", pol:"Польща", can:"Канада", aus:"Австралія",
  ind:"Індія", bra:"Бразилія", ita:"Італія", esp:"Іспанія",
  nld:"Нідерланди", swe:"Швеція", nor:"Норвегія", fin:"Фінляндія",
  bel:"Бельгія", che:"Швейцарія", aut:"Австрія", cze:"Чехія",
  prt:"Португалія", hun:"Угорщина", rou:"Румунія", svk:"Словаччина",
  dnk:"Данія", irl:"Ірландія", nzl:"Нова Зеландія", zaf:"ПАР",
  mex:"Мексика", arg:"Аргентина", chl:"Чилі", col:"Колумбія",
  jpn:"Японія", kor:"Південна Корея", chn:"Китай", sgp:"Сінгапур",
  hkg:"Гонконг", tur:"Туреччина", isr:"Ізраїль", are:"ОАЕ",
  nga:"Нігерія", egy:"Єгипет", pak:"Пакистан", bgd:"Бангладеш",
  idn:"Індонезія", mys:"Малайзія", tha:"Таїланд", phl:"Філіппіни",
  vnm:"В'єтнам", ukr:"Україна", rus:"Росія", blr:"Білорусь",
  kaz:"Казахстан", geo:"Грузія", arm:"Вірменія", uzb:"Узбекистан",
};

export function countryName(code) {
  return COUNTRY_NAMES[code?.toLowerCase()] || code?.toUpperCase() || "—";
}

export default function CountrySelect({ countries = [], value, onChange, className }) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">Всі країни</option>
      {countries.map((c) => (
        <option key={c.country} value={c.country}>
          {countryName(c.country)} ({c.clicks.toLocaleString("uk-UA")} кл.)
        </option>
      ))}
    </select>
  );
}
