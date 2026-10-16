import json
from datetime import date

from app.features import encode_history
from app.festivals import DATA_FILE, FESTIVAL_HORIZON_DAYS, builtin_festivals, festival_code, festival_features, festival_keys

from .conftest import make_history

REQUIRED = {"holi", "eid_al_fitr", "eid_al_adha", "ganesh_chaturthi", "navratri", "dussehra", "diwali", "christmas"}


def test_data_file_covers_2024_to_2027_with_sources():
    raw = json.loads(DATA_FILE.read_text())
    assert set(festival_keys()) == REQUIRED
    for f in raw["festivals"]:
        assert set(f["dates"]) == {"2024", "2025", "2026", "2027"}, f["key"]
        for year, iso in f["dates"].items():
            assert date.fromisoformat(iso).year == int(year)
    assert all(raw["sources"][y].startswith("https://") for y in ("2024", "2025", "2026", "2027"))


def test_known_dates():
    fest = set(builtin_festivals())
    assert (date(2026, 11, 8), "diwali") in fest
    assert (date(2025, 8, 27), "ganesh_chaturthi") in fest
    assert (date(2026, 3, 4), "holi") in fest


def test_festival_features_countdown():
    fest = [(date(2026, 11, 8), "diwali")]
    assert festival_features(date(2026, 11, 8), fest) == (1, 0, festival_code("diwali"))
    assert festival_features(date(2026, 11, 5), fest) == (0, 3, festival_code("diwali"))
    assert festival_features(date(2026, 11, 9), fest) == (0, FESTIVAL_HORIZON_DAYS, 0)  # after: none upcoming
    assert festival_features(date(2026, 9, 1), fest) == (0, FESTIVAL_HORIZON_DAYS, 0)  # too far away
    # the nearest upcoming festival wins
    two = [(date(2026, 10, 20), "dussehra"), (date(2026, 11, 8), "diwali")]
    assert festival_features(date(2026, 10, 18), two) == (0, 2, festival_code("dussehra"))


def test_encoded_frame_uses_request_festivals_or_builtin():
    hist = make_history(days=14, end=date(2026, 10, 14))
    custom = encode_history(hist, [], [(date(2026, 10, 10), "local_fair")])
    day = custom.frame[custom.frame["date"] == date(2026, 10, 10)]
    assert day["festival"].eq(1).all() and day["next_festival"].eq(festival_code("local_fair")).all()
    builtin = encode_history(hist, [])
    oct14 = builtin.frame[builtin.frame["date"] == date(2026, 10, 14)]
    assert oct14["days_to_festival"].eq(6).all()  # Dussehra 2026-10-20
    assert oct14["next_festival"].eq(festival_code("dussehra")).all()
