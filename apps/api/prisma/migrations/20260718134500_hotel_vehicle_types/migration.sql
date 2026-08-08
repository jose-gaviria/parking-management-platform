-- Reemplaza categorías sin uso histórico por categorías hotel.
-- Las tarifas hotel parten con un descuento del 50 % frente a Carro/Moto.

UPDATE "vehicle_types"
SET "code" = 'HOTEL_MOTORCYCLE',
    "name" = 'Moto hotel',
    "icon" = 'motorcycle',
    "sortOrder" = 3,
    "active" = true
WHERE "code" = 'BICYCLE';

UPDATE "vehicle_types"
SET "code" = 'HOTEL_CAR',
    "name" = 'Carro hotel',
    "icon" = 'car',
    "sortOrder" = 4,
    "active" = true
WHERE "code" = 'TRUCK';

UPDATE "tariffs" AS tariff
SET "name" = 'Moto hotel — tarifa especial'
FROM "vehicle_types" AS vehicle_type
WHERE tariff."vehicleTypeId" = vehicle_type."id"
  AND vehicle_type."code" = 'HOTEL_MOTORCYCLE';

UPDATE "tariff_versions" AS version
SET "validTo" = NOW()
FROM "tariffs" AS tariff, "vehicle_types" AS vehicle_type
WHERE version."tariffId" = tariff."id"
  AND tariff."vehicleTypeId" = vehicle_type."id"
  AND vehicle_type."code" = 'HOTEL_MOTORCYCLE'
  AND version."validTo" IS NULL;

INSERT INTO "tariff_versions" (
  "id", "tariffId", "version", "rules", "validFrom", "createdAt"
)
SELECT
  'hotel-motorcycle-v2',
  tariff."id",
  COALESCE(MAX(version."version"), 0) + 1,
  '{"mode":"PER_HOUR","unitPrice":1000,"graceMinutes":10,"dailyMax":6000,"lostTicketFee":10000,"taxPct":0}'::jsonb,
  NOW(),
  NOW()
FROM "tariffs" AS tariff
JOIN "vehicle_types" AS vehicle_type ON vehicle_type."id" = tariff."vehicleTypeId"
LEFT JOIN "tariff_versions" AS version ON version."tariffId" = tariff."id"
WHERE vehicle_type."code" = 'HOTEL_MOTORCYCLE'
GROUP BY tariff."id";

UPDATE "tariffs" AS tariff
SET "name" = 'Carro hotel — tarifa especial'
FROM "vehicle_types" AS vehicle_type
WHERE tariff."vehicleTypeId" = vehicle_type."id"
  AND vehicle_type."code" = 'HOTEL_CAR';

UPDATE "tariff_versions" AS version
SET "validTo" = NOW()
FROM "tariffs" AS tariff, "vehicle_types" AS vehicle_type
WHERE version."tariffId" = tariff."id"
  AND tariff."vehicleTypeId" = vehicle_type."id"
  AND vehicle_type."code" = 'HOTEL_CAR'
  AND version."validTo" IS NULL;

INSERT INTO "tariff_versions" (
  "id", "tariffId", "version", "rules", "validFrom", "createdAt"
)
SELECT
  'hotel-car-v2',
  tariff."id",
  COALESCE(MAX(version."version"), 0) + 1,
  '{"mode":"PER_HOUR","unitPrice":2000,"graceMinutes":10,"dailyMax":12500,"lostTicketFee":15000,"taxPct":0,"timeBands":[{"from":"21:00","to":"06:00","unitPrice":1250}]}'::jsonb,
  NOW(),
  NOW()
FROM "tariffs" AS tariff
JOIN "vehicle_types" AS vehicle_type ON vehicle_type."id" = tariff."vehicleTypeId"
LEFT JOIN "tariff_versions" AS version ON version."tariffId" = tariff."id"
WHERE vehicle_type."code" = 'HOTEL_CAR'
GROUP BY tariff."id";
