import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AmountField } from './amount-field.tsx';

afterEach(cleanup);

describe('AmountField', () => {
  test('edits text, MAX fills the ceiling, the unit and the line under it read once', () => {
    const onChange = vi.fn();
    render(
      <AmountField
        id="amt"
        value="1.5"
        onChange={onChange}
        unit="tYACA"
        max="3.5"
        below="balance 3.5 tYACA"
      />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('1.5');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    fireEvent.change(input, { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith('2');
    fireEvent.click(screen.getByRole('button', { name: 'MAX' }));
    expect(onChange).toHaveBeenLastCalledWith('3.5');
    expect(screen.getByText('tYACA')).toBeInTheDocument();
    expect(screen.getByText('balance 3.5 tYACA')).toBeInTheDocument();
  });

  test('no MAX without a ceiling or while disabled; invalid marks the field', () => {
    const { rerender } = render(<AmountField id="amt" value="" onChange={() => {}} unit="YACA" invalid />);
    expect(screen.queryByRole('button', { name: 'MAX' })).toBeNull();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    rerender(<AmountField id="amt" value="" onChange={() => {}} unit="YACA" max="1" disabled />);
    expect(screen.queryByRole('button', { name: 'MAX' })).toBeNull();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
