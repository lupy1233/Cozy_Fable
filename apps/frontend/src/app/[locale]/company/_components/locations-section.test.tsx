import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { CompanyDto, ErrorCode } from '@marketplace/shared';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../../messages/ro.json';

// h1 (etapa 11), pasul 3: „Modifică” pe locatie, adresa cu sugestii Google, raza din selector,
// fara coordonate scrise de mana, erorile serverului pe camp.

const state: { addError: unknown; editError: unknown } = { addError: null, editError: null };
const addMutate = vi.fn();
const editMutate = vi.fn();
vi.mock('@/hooks/use-company', () => ({
  useAddLocation: () => ({ mutate: addMutate, reset: vi.fn(), isPending: false, error: state.addError }),
  useUpdateLocation: () => ({ mutate: editMutate, reset: vi.fn(), isPending: false, error: state.editError }),
  useDeleteLocation: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null }),
}));

const company = {
  locations: [
    { id: 'loc-1', addressText: 'Strada Fabricii 5', county: 'Cluj', city: 'Cluj-Napoca', lat: 46.7, lng: 23.6, coverageRadiusKm: 30 },
  ],
} as unknown as CompanyDto;

type Listener = () => void;
function installPlaces(place: unknown) {
  const places: { listener: Listener | null } = { listener: null };
  window.google = {
    maps: {
      places: {
        Autocomplete: class {
          addListener(_name: string, fn: Listener) { places.listener = fn; }
          getPlace() { return place; }
          setComponentRestrictions() {}
        },
      },
      Geocoder: class { geocode() {} },
    },
  };
  return places;
}

type ErrorSpec = [code: string, status: number, details?: unknown];

async function renderSection(opts: { withPlacesKey?: boolean; addError?: ErrorSpec; editError?: ErrorSpec } = {}) {
  vi.resetModules();
  if (opts.withPlacesKey) vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-key');
  // dupa resetModules, componenta vede o clasa ApiError noua → erorile se fac din aceeasi copie
  const api = await import('@/lib/api');
  const make = (s?: ErrorSpec) => (s ? new api.ApiError(s[0] as ErrorCode, s[1], 'x', s[2]) : null);
  state.addError = make(opts.addError);
  state.editError = make(opts.editError);
  const { LocationsSection } = await import('./locations-section');
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <LocationsSection company={company} canManage />
    </NextIntlClientProvider>,
  );
}

const c = ro.Company;
const fullAddress = 'Strada Fabricii 5, Cluj-Napoca, Cluj, România';

describe('LocationsSection (h1)', () => {
  // primul import dinamic transforma tot arborele de module (lent pe un PC incarcat)
  beforeAll(async () => {
    await import('./locations-section');
  }, 60_000);
  beforeEach(() => {
    state.addError = null;
    state.editError = null;
    addMutate.mockReset();
    editMutate.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.google;
  });

  it('„Modifică” deschide formularul precompletat; salvarea trimite adresa si raza, fara coordonate', async () => {
    await renderSection();
    fireEvent.click(screen.getByRole('button', { name: c.editLocationAria.replace('{address}', fullAddress) }));
    expect(screen.getByLabelText(c.locationAddress)).toHaveValue('Strada Fabricii 5');
    expect(screen.getByLabelText(c.county)).toHaveValue('Cluj');
    expect(screen.getByLabelText(c.city)).toHaveValue('Cluj-Napoca');
    const radius = screen.getByLabelText(c.coverageRadius);
    expect(radius).toHaveValue('30');
    // campurile de latitudine / longitudine nu mai exista
    expect(screen.queryByText('Latitudine')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

    fireEvent.change(radius, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: c.saveLocation }));
    expect(editMutate).toHaveBeenCalledTimes(1);
    const sent = editMutate.mock.calls[0][0];
    expect(sent).toEqual({ id: 'loc-1', addressText: 'Strada Fabricii 5', county: 'Cluj', city: 'Cluj-Napoca', coverageRadiusKm: 100 });
    expect(sent).not.toHaveProperty('lat');
  });

  it('selectorul de raza incepe de la raza minima si pastreaza o raza salvata din afara listei', async () => {
    const { RADIUS_OPTIONS_KM } = await import('./locations-section');
    expect(Math.min(...RADIUS_OPTIONS_KM)).toBe(2);
    company.locations[0].coverageRadiusKm = 37;
    await renderSection();
    fireEvent.click(screen.getByRole('button', { name: c.editLocationAria.replace('{address}', fullAddress) }));
    expect(screen.getByLabelText(c.coverageRadius)).toHaveValue('37');
    company.locations[0].coverageRadiusKm = 30;
  });

  it('alegerea unei sugestii Google completeaza judetul si orasul (coordonatele le pune serverul)', async () => {
    const places = installPlaces({
      address_components: [
        { long_name: 'Strada Lalelelor', types: ['route'] },
        { long_name: '10', types: ['street_number'] },
        { long_name: 'Voluntari', types: ['locality'] },
        { long_name: 'Județul Ilfov', types: ['administrative_area_level_1'] },
      ],
      formatted_address: 'Strada Lalelelor 10, Voluntari, Romania',
    });
    await renderSection({ withPlacesKey: true });
    fireEvent.click(screen.getByRole('button', { name: c.addLocation }));
    const address = screen.getByLabelText(c.locationAddress);
    fireEvent.change(address, { target: { value: 'Strada Lalelelor 10' } });
    await vi.waitFor(() => expect(places.listener).not.toBeNull());
    act(() => places.listener!());
    expect(screen.getByLabelText(c.county)).toHaveValue('Ilfov');
    expect(screen.getByLabelText(c.city)).toHaveValue('Voluntari');
    const form = address.closest('form')!;
    fireEvent.click(within(form).getByRole('button', { name: c.addLocation }));
    expect(addMutate.mock.calls[0][0]).toEqual({
      addressText: 'Strada Lalelelor 10',
      county: 'Ilfov',
      city: 'Voluntari',
      coverageRadiusKm: 50,
    });
  });

  it('fara cheie Google: campul de adresa ramane text simplu, iar campurile goale se semnaleaza local', async () => {
    await renderSection();
    fireEvent.click(screen.getByRole('button', { name: c.addLocation }));
    const address = screen.getByLabelText(c.locationAddress);
    const form = address.closest('form')!;
    fireEvent.click(within(form).getByRole('button', { name: c.addLocation }));
    expect(addMutate).not.toHaveBeenCalled();
    expect(screen.getByText(c.validation.addressTooShort)).toBeInTheDocument();
    expect(screen.getByText(c.validation.countyTooShort)).toBeInTheDocument();
  });

  it('raza sub minim respinsa de server → mesajul pe campul razei', async () => {
    await renderSection({ editError: ['VALIDATION_ERROR', 400, ['coverageRadiusKm must not be less than 2']] });
    fireEvent.click(screen.getByRole('button', { name: c.editLocationAria.replace('{address}', fullAddress) }));
    expect(screen.getByLabelText(c.coverageRadius)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(c.validation.radiusTooSmall.replace('{min}', '2'))).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('adresa care nu se gaseste pe harta → mesajul pe campul adresei', async () => {
    await renderSection({ addError: ['GEOCODING_FAILED', 502] });
    fireEvent.click(screen.getByRole('button', { name: c.addLocation }));
    expect(screen.getByText(c.apiErrors.GEOCODING_FAILED)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // h1 (revizuire m6): adresa exacta negasita → nota neblocanta sub locatia salvata
  it('salvata cu centrul orasului → nota sub locatie; cu adresa exacta → fara nota', async () => {
    editMutate.mockImplementationOnce((_input, opts) => opts?.onSuccess?.({ ...company, geocodePrecision: 'CITY' }));
    await renderSection();
    fireEvent.click(screen.getByRole('button', { name: c.editLocationAria.replace('{address}', fullAddress) }));
    fireEvent.click(screen.getByRole('button', { name: c.saveLocation }));
    expect(await screen.findByRole('status')).toHaveTextContent(c.locationCityOnlyNote);

    editMutate.mockImplementationOnce((_input, opts) => opts?.onSuccess?.({ ...company }));
    fireEvent.click(screen.getByRole('button', { name: c.editLocationAria.replace('{address}', fullAddress) }));
    fireEvent.click(screen.getByRole('button', { name: c.saveLocation }));
    await vi.waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('plafonul de schimbari atins → mesajul serverului in limba omului', async () => {
    await renderSection({ editError: ['COMPANY_LOCATION_CHANGE_LIMIT', 429] });
    fireEvent.click(screen.getByRole('button', { name: c.editLocationAria.replace('{address}', fullAddress) }));
    expect(screen.getByRole('alert')).toHaveTextContent(c.apiErrors.COMPANY_LOCATION_CHANGE_LIMIT);
  });
});
