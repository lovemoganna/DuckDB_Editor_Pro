import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HomeHeader } from './HomeHeader';

afterEach(cleanup);
it('opens the analysis switcher from the keyboard, navigates options and returns focus on selection', () => {
  const onSwitch = vi.fn();
  render(<HomeHeader onNavigate={vi.fn()} onSwitchAnalysisContext={onSwitch} analysisContexts={[
    {id:'memory',label:'当前数据库',kind:'database',isCurrent:true},
    {id:'research',label:'研究数据库',kind:'database',isCurrent:false},
    {id:'main',label:'main',kind:'schema',isCurrent:false},
  ]}/>);
  const trigger = screen.getByRole('button', {name:'当前数据库'});
  trigger.focus(); fireEvent.keyDown(trigger, {key:'ArrowDown'});
  expect(document.activeElement).toBe(screen.getByRole('option', {name:'当前数据库'}));
  fireEvent.keyDown(document.activeElement!, {key:'End'});
  expect(document.activeElement).toBe(screen.getByRole('option', {name:'main'}));
  fireEvent.keyDown(document.activeElement!, {key:'Home'});
  fireEvent.keyDown(document.activeElement!, {key:'ArrowDown'});
  expect(document.activeElement).toBe(screen.getByRole('option', {name:'研究数据库'}));
  fireEvent.click(document.activeElement!);
  expect(onSwitch).toHaveBeenCalledWith({id:'research',kind:'database'});
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger); fireEvent.keyDown(document.activeElement!, {key:'Escape'});
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('dismisses when focus leaves and keeps the database manager outside the option list', () => {
  render(<HomeHeader onNavigate={vi.fn()} onRefresh={vi.fn()} onSwitchAnalysisContext={vi.fn()} analysisContexts={[
    {id:'memory',label:'当前数据库',kind:'database',isCurrent:true},
  ]}/>);
  const trigger = screen.getByRole('button', {name:'当前数据库'});
  fireEvent.click(trigger);
  expect(screen.getByRole('listbox').contains(screen.getByRole('button', {name:/管理数据库/}))).toBe(false);
  fireEvent.blur(screen.getByRole('option'), {relatedTarget:screen.getByRole('button', {name:'刷新数据'})});
  expect(screen.queryByRole('listbox')).toBeNull();
});
