import { formatExact, formatDatetime, formatBoolean } from './formatters.js';
import { useBootstrap } from '../composables/useBootstrap.js';

export function getFields() {
  const { config } = useBootstrap();
  const placeItems = (config && config.place && config.place.items) || [];

  return [
    {
      attr: 'id',
      label: 'id',
      format: (value) => `<a target="_blank" href="/admin/detail/${value}/">${value}</a>`,
      widget: 'PlaceFieldReadOnlyWidget',
    },
    {
      attr: 'created_datetime',
      label: 'created_datetime',
      format: formatDatetime,
      widget: 'PlaceFieldDateTimeWidget',
      filter: 'PlacesDateTimeFilter',
    },
    ...placeItems.map((field) => {
      const adminFieldOptions = {
        attr: field.name,
        label: field.name,
        format: formatExact,
      };

      if (field.type === 'select' || field.type === 'radiogroup' || field.type === 'checkboxgroup' || Array.isArray(field.options)) {
        adminFieldOptions.options = field.options;
        adminFieldOptions.widget = 'PlaceFieldChoiceWidget';
        adminFieldOptions.filter = 'PlacesChoiceFilter';
      } else {
        adminFieldOptions.widget = 'PlaceFieldLongTextWidget';
        adminFieldOptions.filter = 'PlacesSubstringFilter';
      }

      return adminFieldOptions;
    }),
    {
      attr: 'user_token',
      label: 'user_token',
      format: formatExact,
      widget: 'PlaceFieldReadOnlyWidget',
      filter: 'PlacesSubstringFilter',
    },
    {
      attr: 'visible',
      label: 'visible',
      format: formatBoolean,
      widget: 'PlaceFieldBooleanWidget',
      filter: 'PlacesBooleanFilter',
    },
  ];
}
