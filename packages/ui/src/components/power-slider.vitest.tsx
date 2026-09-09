import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PowerSlider } from './power-slider.tsx';

afterEach(cleanup);

describe('PowerSlider', () => {
  test('disabled keeps the setting visible, dims the block and disables the input (a browser dispatches nothing on it)', () => {
    const onChange = vi.fn();
    const { container, getByRole, rerender } = render(
      <PowerSlider cores={12} threads={11} onChange={onChange} disabled />,
    );
    const block = container.querySelector('[data-slot=power-slider]') as HTMLElement;
    expect(block.dataset.disabled).toBe('');
    expect(block.className).toContain('opacity-45');
    const slider = getByRole('slider') as HTMLInputElement;
    expect(slider.disabled).toBe(true);
    expect(block.textContent).toContain('11 threads');
    rerender(<PowerSlider cores={12} threads={11} onChange={onChange} />);
    expect(block.dataset.disabled).toBeUndefined();
    expect((getByRole('slider') as HTMLInputElement).disabled).toBe(false);
  });
});
